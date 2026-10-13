import "server-only";

import { randomBytes } from "node:crypto";
import { SITE } from "@/data/site";
import { sendMail } from "@/lib/mail";
import {
  type Booking,
  bookingById,
  cancelBooking,
  claimReminder,
  confirmBooking,
  confirmedBetween,
  holdSlot,
  liveBookings,
  moveBooking,
  releaseReminder,
  releaseSlot,
} from "./database";
import { deleteEvent, freeBusy, googleConfigured, insertEvent, moveEvent } from "./google";
import { bookingLog, reasonOf } from "./log";
import {
  eventDescription,
  eventSummary,
  guestCancelled,
  guestConfirmed,
  guestReminder,
  guestRescheduled,
  type Links,
  ownerBooked,
  ownerCancelled,
  ownerRescheduled,
} from "./messages";
import { BOOKING, type BookingSettings } from "./settings";
import { availabilityRange, type Busy, computeSlots } from "./slots";
import { bookingIdFrom, manageToken } from "./tokens";

// The booking flow, between the routes and the calendar, database and mail. A
// booking holds its slot in the database first, so two visitors can't both have
// it, then makes the calendar event, then confirms. Emails go out after.

const MINUTE = 60_000;

/** The site's address for links in emails. Never taken from the request's Host header. */
export function siteOrigin(request?: Request) {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") return SITE.url;
  return request ? new URL(request.url).origin : "http://localhost:3000";
}

/** The links in a booking's emails, to move or cancel it. */
export function linksFor(id: string, origin: string): Links {
  const token = manageToken(id);
  return {
    manage: `${origin}/api/booking/manage?token=${token}`,
    reschedule: `${origin}/book?reschedule=${token}`,
  };
}

/** Busy times across the settings' calendars. Under `next dev` without Google, there are none. */
async function busyTimes(settings: BookingSettings, now: number): Promise<Busy[]> {
  if (!googleConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Google Calendar isn’t configured");
    return [];
  }
  const { timeMin, timeMax } = availabilityRange(settings, now);
  return freeBusy(settings.busyCalendarIds, timeMin, timeMax);
}

/** The times a call can be booked at, now. `moving` is a booking being rescheduled. */
export async function availableSlots(settings: BookingSettings = BOOKING, moving?: Booking) {
  const now = Date.now();
  const [busy, booked] = await Promise.all([
    busyTimes(settings, now),
    liveBookings(new Date(now - 24 * 60 * MINUTE).toISOString()),
  ]);
  // Bookings block their own time too, in case the calendar hasn't caught up with one yet.
  return computeSlots(settings, {
    now,
    busy: [...busy, ...booked],
    booked: booked.map((b) => b.start),
    moving: moving && { start: moving.start, end: moving.end },
  });
}

/** Our id for the booking's calendar event: Google wants base32hex, 5–1024 characters. */
const eventId = () => {
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  return `ok${Array.from(randomBytes(20), (b) => alphabet[b & 31]).join("")}`;
};

export type BookingRequest = {
  start: string;
  name: string;
  email: string;
  timezone: string;
  answers: Record<string, string>;
};

export type BookResult =
  | { ok: true; booking: Booking; links: Links }
  | { ok: false; error: "slot-taken" | "calendar-failed" };

async function send(what: string, build: () => Promise<Parameters<typeof sendMail>[0]>) {
  try {
    await sendMail(await build());
  } catch (error) {
    bookingLog("error", { reason: `${what} didn’t send: ${reasonOf(error)}` });
  }
}

export async function book(request: BookingRequest, origin: string): Promise<BookResult> {
  const settings = BOOKING;
  const start = new Date(request.start).toISOString();
  const end = new Date(Date.parse(start) + settings.durationMinutes * MINUTE).toISOString();
  if (!(await availableSlots(settings)).includes(start)) return { ok: false, error: "slot-taken" };

  const id = `bk_${randomBytes(12).toString("base64url")}`;
  const pending = {
    id,
    eventId: eventId(),
    calendarId: settings.calendarId,
    start,
    end,
    guestName: request.name,
    guestEmail: request.email,
    guestTimezone: request.timezone,
    answers: request.answers,
  };
  if (!(await holdSlot(pending, settings.bufferMinutes * MINUTE))) return { ok: false, error: "slot-taken" };

  let icalUid = `${pending.eventId}@google.com`;
  let meetLink: string | null = null;
  try {
    if (googleConfigured()) {
      ({ iCalUID: icalUid, meetLink } = await insertEvent(settings.calendarId, {
        id: pending.eventId,
        summary: eventSummary(request.name, settings),
        description: eventDescription({ ...request, guestName: request.name, guestEmail: request.email }, settings),
        start,
        end,
        attendee: { email: request.email, name: request.name },
      }));
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("Google Calendar isn’t configured");
    }
  } catch (error) {
    bookingLog("error", { reason: `calendar event wasn’t made: ${reasonOf(error)}` });
    await releaseSlot(id);
    return { ok: false, error: "calendar-failed" };
  }
  await confirmBooking(id, icalUid, meetLink);
  const booking = (await bookingById(id))!;
  bookingLog("booked", { domain: request.email.split("@")[1] });
  return { ok: true, booking, links: linksFor(id, origin) };
}

/** The emails for a new booking; run after the response. */
export async function sendBookedEmails(booking: Booking, links: Links) {
  await Promise.all([
    send("booking confirmation", () => guestConfirmed(booking, BOOKING, links)),
    send("booking notice", () => ownerBooked(booking, BOOKING)),
  ]);
}

/** The booking a manage link points at, or null if the link is bad. */
export async function bookingForToken(token: string) {
  const id = bookingIdFrom(token);
  return id ? bookingById(id) : null;
}

export type ChangeError = "not-found" | "cancelled" | "slot-taken" | "past" | "calendar-failed";
export type ChangeResult = { ok: true; booking: Booking; links: Links } | { ok: false; error: ChangeError };

/** Moves a booking to `start`, if it's free and the booking hasn't happened. */
export async function reschedule(
  token: string,
  startGiven: string,
  origin: string,
): Promise<
  | { ok: true; booking: Booking; previous: { start: string; end: string }; links: Links }
  | { ok: false; error: ChangeError }
> {
  const settings = BOOKING;
  const booking = await bookingForToken(token);
  if (booking?.status === "cancelled") return { ok: false, error: "cancelled" };
  if (booking?.status !== "confirmed") return { ok: false, error: "not-found" };
  if (Date.parse(booking.start) < Date.now()) return { ok: false, error: "past" };
  const start = new Date(startGiven).toISOString();
  const end = new Date(Date.parse(start) + settings.durationMinutes * MINUTE).toISOString();
  if (!(await availableSlots(settings, booking)).includes(start)) return { ok: false, error: "slot-taken" };
  if (!(await moveBooking(booking.id, start, end, settings.bufferMinutes * MINUTE))) {
    return { ok: false, error: "slot-taken" };
  }
  try {
    if (googleConfigured()) await moveEvent(booking.calendarId, booking.eventId, start, end);
  } catch (error) {
    bookingLog("error", { reason: `calendar event didn’t move: ${reasonOf(error)}` });
    await moveBooking(booking.id, booking.start, booking.end, 0);
    return { ok: false, error: "calendar-failed" };
  }
  bookingLog("rescheduled");
  return {
    ok: true,
    booking: (await bookingById(booking.id))!,
    previous: { start: booking.start, end: booking.end },
    links: linksFor(booking.id, origin),
  };
}

export async function sendRescheduledEmails(booking: Booking, previous: { start: string; end: string }, links: Links) {
  await Promise.all([
    send("reschedule confirmation", () => guestRescheduled(booking, BOOKING, links)),
    send("reschedule notice", () => ownerRescheduled(booking, BOOKING, previous.start, previous.end)),
  ]);
}

/** Cancels a booking and takes it off the calendar. */
export async function cancel(token: string, origin: string): Promise<ChangeResult> {
  const booking = await bookingForToken(token);
  if (booking?.status === "cancelled") return { ok: false, error: "cancelled" };
  if (booking?.status !== "confirmed") return { ok: false, error: "not-found" };
  if (Date.parse(booking.end) < Date.now()) return { ok: false, error: "past" };
  try {
    if (googleConfigured()) await deleteEvent(booking.calendarId, booking.eventId);
  } catch (error) {
    bookingLog("error", { reason: `calendar event wasn’t deleted: ${reasonOf(error)}` });
    return { ok: false, error: "calendar-failed" };
  }
  if (!(await cancelBooking(booking.id))) return { ok: false, error: "not-found" };
  bookingLog("cancelled");
  return { ok: true, booking: (await bookingById(booking.id))!, links: linksFor(booking.id, origin) };
}

export async function sendCancelledEmails(booking: Booking, links: Links, origin: string) {
  await Promise.all([
    send("cancellation", () => guestCancelled(booking, BOOKING, links, `${origin}/book`)),
    send("cancellation notice", () => ownerCancelled(booking, BOOKING)),
  ]);
}

/**
 * Sends the reminders that are due: a day ahead (for calls booked more than a day
 * and a half out, since a sooner one's confirmation is fresh) and an hour ahead.
 * Each is claimed in the database first, so it goes once however often this runs.
 */
export async function sendDueReminders(origin: string, now = Date.now()) {
  const upcoming = await confirmedBetween(new Date(now).toISOString(), new Date(now + 25 * 60 * MINUTE).toISOString());
  let sent = 0;
  for (const booking of upcoming) {
    const until = Date.parse(booking.start) - now;
    const lead = Date.parse(booking.start) - Date.parse(booking.createdAt);
    const which =
      until <= 75 * MINUTE
        ? booking.reminderHourAt
          ? null
          : "hour"
        : until <= 24 * 60 * MINUTE && !booking.reminderDayAt && lead > 36 * 60 * MINUTE
          ? "day"
          : null;
    if (!which || !(await claimReminder(booking.id, which, booking.start))) continue;
    try {
      await sendMail(await guestReminder(booking, BOOKING, linksFor(booking.id, origin), which));
      sent++;
    } catch (error) {
      bookingLog("error", { reason: `reminder didn’t send: ${reasonOf(error)}` });
      await releaseReminder(booking.id, which);
    }
  }
  return { checked: upcoming.length, sent };
}
