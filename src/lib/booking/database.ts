import "server-only";

import type { Client, Row } from "@libsql/client/http";
import { databaseClient } from "@/lib/database";

// Bookings, in Turso. Unlike the site check, nothing here fails open: a booking
// that can't be saved isn't made. Under `next dev` without Turso they go in a
// local file, .data/bookings.db, built from bookings.sql.

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  eventId: string;
  calendarId: string;
  icalUid: string | null;
  start: string;
  end: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  answers: Record<string, string>;
  meetLink: string | null;
  status: BookingStatus;
  sequence: number;
  reminderDayAt: string | null;
  reminderHourAt: string | null;
  createdAt: string;
};

let local: Promise<Client> | undefined;

async function localDatabase() {
  const { mkdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { createClient } = await import("@libsql/client");
  const directory = join(process.cwd(), ".data");
  await mkdir(directory, { recursive: true });
  const client = createClient({ url: `file:${join(directory, "bookings.db")}` }) as unknown as Client;
  await client.executeMultiple(await readFile(join(process.cwd(), "src/lib/booking/bookings.sql"), "utf8"));
  return client;
}

async function database(): Promise<Client> {
  const client = databaseClient();
  if (client) return client;
  if (process.env.NODE_ENV === "production") throw new Error("Bookings need TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  local ??= localDatabase();
  return local;
}

const toBooking = (row: Row): Booking => ({
  id: String(row.id),
  eventId: String(row.event_id),
  calendarId: String(row.calendar_id),
  icalUid: row.ical_uid === null ? null : String(row.ical_uid),
  start: String(row.start_at),
  end: String(row.end_at),
  guestName: String(row.guest_name),
  guestEmail: String(row.guest_email),
  guestTimezone: String(row.guest_timezone),
  answers: JSON.parse(String(row.answers_json)),
  meetLink: row.meet_link === null ? null : String(row.meet_link),
  status: String(row.status) as BookingStatus,
  sequence: Number(row.sequence),
  reminderDayAt: row.reminder_day_at === null ? null : String(row.reminder_day_at),
  reminderHourAt: row.reminder_hour_at === null ? null : String(row.reminder_hour_at),
  createdAt: String(row.created_at),
});

/** How long a pending booking holds its slot before it's taken as abandoned (a crash between hold and confirm). */
const PENDING_MS = 5 * 60_000;

const isConflict = (error: unknown) => error instanceof Error && /UNIQUE constraint failed/i.test(error.message);

/** Live bookings, other than `except`, that overlap `from`–`to`. */
async function overlapping(db: Client, from: string, to: string, except?: string) {
  const result = await db.execute({
    sql: `SELECT id FROM bookings WHERE status IN ('pending', 'confirmed') AND start_at < ? AND end_at > ? AND id != ?`,
    args: [to, from, except ?? ""],
  });
  return result.rows.length > 0;
}

export type NewBooking = Omit<
  Booking,
  "icalUid" | "meetLink" | "status" | "sequence" | "reminderDayAt" | "reminderHourAt" | "createdAt"
>;

/**
 * Holds a slot with a pending booking. False if another booking already has that
 * time or comes within `bufferMs` of it, so of two people racing for a slot one
 * gets it (or, rarely, neither, and both pick again).
 */
export async function holdSlot(booking: NewBooking, bufferMs: number, now = new Date()) {
  const db = await database();
  await db.execute({
    sql: "DELETE FROM bookings WHERE status = 'pending' AND created_at < ?",
    args: [new Date(now.getTime() - PENDING_MS).toISOString()],
  });
  const from = new Date(Date.parse(booking.start) - bufferMs).toISOString();
  const to = new Date(Date.parse(booking.end) + bufferMs).toISOString();
  if (await overlapping(db, from, to)) return false;
  try {
    await db.execute({
      sql: `INSERT INTO bookings (id, event_id, calendar_id, start_at, end_at, guest_name, guest_email, guest_timezone,
          answers_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      args: [
        booking.id,
        booking.eventId,
        booking.calendarId,
        booking.start,
        booking.end,
        booking.guestName,
        booking.guestEmail,
        booking.guestTimezone,
        JSON.stringify(booking.answers),
        now.toISOString(),
        now.toISOString(),
      ],
    });
  } catch (error) {
    if (isConflict(error)) return false;
    throw error;
  }
  if (await overlapping(db, from, to, booking.id)) {
    await releaseSlot(booking.id);
    return false;
  }
  return true;
}

/** Gives up a pending booking's slot, when its calendar event couldn't be made. */
export async function releaseSlot(id: string) {
  const db = await database();
  await db.execute({ sql: "DELETE FROM bookings WHERE id = ? AND status = 'pending'", args: [id] });
}

export async function confirmBooking(id: string, icalUid: string, meetLink: string | null) {
  const db = await database();
  await db.execute({
    sql: "UPDATE bookings SET status = 'confirmed', ical_uid = ?, meet_link = ?, updated_at = ? WHERE id = ?",
    args: [icalUid, meetLink, new Date().toISOString(), id],
  });
}

/** Live bookings from `from` on: they block their time, and count towards their day's limit. */
export async function liveBookings(from: string) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT start_at, end_at FROM bookings WHERE status IN ('pending', 'confirmed') AND start_at >= ?",
    args: [from],
  });
  return result.rows.map((r) => ({ start: String(r.start_at), end: String(r.end_at) }));
}

/** How many calls `email` has coming up. */
export async function upcomingCount(email: string, now = new Date()) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT count(*) AS n FROM bookings WHERE guest_email = ? AND status IN ('pending', 'confirmed') AND start_at > ?",
    args: [email, now.toISOString()],
  });
  return Number(result.rows[0].n);
}

/**
 * Moves a confirmed booking, bumping its sequence and clearing its reminders. False if
 * another booking has the new time or comes within `bufferMs` of it.
 */
export async function moveBooking(id: string, start: string, end: string, bufferMs: number) {
  const db = await database();
  const from = new Date(Date.parse(start) - bufferMs).toISOString();
  const to = new Date(Date.parse(end) + bufferMs).toISOString();
  if (await overlapping(db, from, to, id)) return false;
  try {
    const result = await db.execute({
      sql: `UPDATE bookings SET start_at = ?, end_at = ?, sequence = sequence + 1, reminder_day_at = NULL,
          reminder_hour_at = NULL, updated_at = ? WHERE id = ? AND status = 'confirmed'`,
      args: [start, end, new Date().toISOString(), id],
    });
    return result.rowsAffected === 1;
  } catch (error) {
    if (isConflict(error)) return false;
    throw error;
  }
}

/** Cancels a confirmed booking; false if it was already cancelled. */
export async function cancelBooking(id: string) {
  const db = await database();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `UPDATE bookings SET status = 'cancelled', sequence = sequence + 1, cancelled_at = ?, updated_at = ?
      WHERE id = ? AND status = 'confirmed'`,
    args: [now, now, id],
  });
  return result.rowsAffected === 1;
}

export async function bookingById(id: string) {
  const db = await database();
  const result = await db.execute({ sql: "SELECT * FROM bookings WHERE id = ?", args: [id] });
  return result.rows[0] ? toBooking(result.rows[0]) : null;
}

/** Confirmed bookings starting between `from` and `to`, soonest first. */
export async function confirmedBetween(from: string, to: string) {
  const db = await database();
  const result = await db.execute({
    sql: "SELECT * FROM bookings WHERE status = 'confirmed' AND start_at > ? AND start_at <= ? ORDER BY start_at",
    args: [from, to],
  });
  return result.rows.map(toBooking);
}

/**
 * Claims a booking's reminder so it's only sent once, even if two runs of the job
 * overlap. False if it's already been claimed. `start` guards against a booking
 * that moved after it was read.
 */
export async function claimReminder(id: string, which: "day" | "hour", start: string) {
  const db = await database();
  const column = which === "day" ? "reminder_day_at" : "reminder_hour_at";
  const result = await db.execute({
    sql: `UPDATE bookings SET ${column} = ? WHERE id = ? AND start_at = ? AND status = 'confirmed' AND ${column} IS NULL`,
    args: [new Date().toISOString(), id, start],
  });
  return result.rowsAffected === 1;
}

/** Hands a reminder's claim back, when it didn't send. */
export async function releaseReminder(id: string, which: "day" | "hour") {
  const db = await database();
  const column = which === "day" ? "reminder_day_at" : "reminder_hour_at";
  await db.execute({ sql: `UPDATE bookings SET ${column} = NULL WHERE id = ?`, args: [id] });
}

/** How long a booking is kept after its call, as the privacy policy says. */
export const BOOKING_RETENTION_DAYS = 2 * 365;

/** Deletes bookings, cancelled ones included, whose call ended over BOOKING_RETENTION_DAYS ago. */
export async function deleteOldBookings(now = new Date()) {
  const db = await database();
  const before = new Date(now.getTime() - BOOKING_RETENTION_DAYS * 86_400_000).toISOString();
  const result = await db.execute({ sql: "DELETE FROM bookings WHERE end_at < ?", args: [before] });
  return result.rowsAffected;
}
