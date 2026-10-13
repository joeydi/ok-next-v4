import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type Client, createClient } from "@libsql/client";
import { setDatabaseClient } from "@/lib/database";
import {
  cancelBooking,
  claimReminder,
  confirmBooking,
  confirmedBetween,
  deleteOldBookings,
  holdSlot,
  liveBookings,
  moveBooking,
  type NewBooking,
  releaseSlot,
} from "./database";
import { buildIcs } from "./ics";
import { type BookingSettings, DAYS, validateBookingSettings } from "./settings";
import { computeSlots, zonedTime } from "./slots";
import { bookingIdFrom, manageToken } from "./tokens";

const base: BookingSettings = {
  calendarId: "primary",
  busyCalendarIds: ["primary"],
  timezone: "America/New_York",
  title: "20-min call",
  durationMinutes: 20,
  stepMinutes: 30,
  bufferMinutes: 10,
  minNoticeHours: 0,
  windowDays: 6,
  maxPerDay: 10,
  weeklyHours: Object.fromEntries(DAYS.map((d) => [d, []])) as unknown as BookingSettings["weeklyHours"],
  blackouts: [],
  questions: [],
};

const settings = (patch: Partial<BookingSettings> = {}, hours: Partial<BookingSettings["weeklyHours"]> = {}) =>
  validateBookingSettings({ ...base, ...patch, weeklyHours: { ...base.weeklyHours, ...hours } });

const at = (iso: string) => Date.parse(iso);

describe("validateBookingSettings", () => {
  it("accepts the committed settings", async () => {
    const raw = JSON.parse(await readFile(join(process.cwd(), "src/data/booking.json"), "utf8"));
    assert.doesNotThrow(() => validateBookingSettings(raw));
  });

  it("always counts the booking calendar as busy", () => {
    assert.deepEqual(settings({ calendarId: "work", busyCalendarIds: ["home", ""] }).busyCalendarIds, ["work", "home"]);
  });

  for (const [why, patch, hours] of [
    ["an unknown timezone", { timezone: "Mars/Olympus" }, {}],
    ["a window that ends before it starts", {}, { mon: [{ start: "12:00", end: "10:00" }] }],
    [
      "overlapping windows",
      {},
      {
        mon: [
          { start: "09:00", end: "12:00" },
          { start: "11:00", end: "13:00" },
        ],
      },
    ],
    ["a window shorter than a call", {}, { mon: [{ start: "09:00", end: "09:10" }] }],
    ["a time that isn't 24-hour", {}, { mon: [{ start: "9am", end: "12:00" }] }],
    ["a blackout that ends before it starts", { blackouts: [{ start: "2026-12-26", end: "2026-12-24" }] }, {}],
    ["a question using the name id", { questions: [{ id: "name", label: "Name", type: "text", required: true }] }, {}],
    [
      "a choice with one option",
      { questions: [{ id: "q", label: "Q", type: "select", required: true, options: ["a"] }] },
      {},
    ],
    ["a zero-length call", { durationMinutes: 0 }, {}],
  ] as const) {
    it(`refuses ${why}`, () => {
      assert.throws(() =>
        settings(patch as Partial<BookingSettings>, hours as Partial<BookingSettings["weeklyHours"]>),
      );
    });
  }
});

describe("zonedTime", () => {
  it("skips a time that a spring-forward change jumps over", () => {
    assert.equal(zonedTime("2026-03-08", 2 * 60 + 30, "America/New_York"), null);
    assert.equal(zonedTime("2026-03-08", 3 * 60, "America/New_York"), at("2026-03-08T07:00:00Z"));
  });

  it("takes the first of a time that a fall-back change repeats", () => {
    assert.equal(zonedTime("2026-11-01", 60 + 30, "America/New_York"), at("2026-11-01T05:30:00Z"));
  });
});

describe("computeSlots", () => {
  const weekdays = { mon: [{ start: "10:00", end: "12:00" }] };

  it("offers times inside the weekly hours, in the owner's timezone", () => {
    const slots = computeSlots(settings({}, weekdays), { now: at("2026-10-15T12:00:00Z") });
    assert.deepEqual(slots, [
      "2026-10-19T14:00:00.000Z",
      "2026-10-19T14:30:00.000Z",
      "2026-10-19T15:00:00.000Z",
      "2026-10-19T15:30:00.000Z",
    ]);
  });

  it("follows the clocks across a daylight saving change", () => {
    const slots = computeSlots(settings({}, weekdays), { now: at("2026-10-29T12:00:00Z") });
    assert.equal(slots[0], "2026-11-02T15:00:00.000Z");
  });

  it("skips the hour a spring-forward change removes", () => {
    const slots = computeSlots(settings({}, { sun: [{ start: "01:00", end: "04:00" }] }), {
      now: at("2026-03-06T12:00:00Z"),
    });
    assert.deepEqual(slots, [
      "2026-03-08T06:00:00.000Z",
      "2026-03-08T06:30:00.000Z",
      "2026-03-08T07:00:00.000Z",
      "2026-03-08T07:30:00.000Z",
    ]);
  });

  it("keeps the minimum notice", () => {
    const slots = computeSlots(settings({ minNoticeHours: 1 }, weekdays), { now: at("2026-10-19T14:15:00Z") });
    assert.equal(slots[0], "2026-10-19T15:30:00.000Z");
  });

  it("keeps a buffer around busy times", () => {
    const slots = computeSlots(settings({}, weekdays), {
      now: at("2026-10-15T12:00:00Z"),
      // 10:40–11:00 local: blocks 10:30 (ends 10:50 + 10) and 11:00 (starts 11:00 − 10).
      busy: [{ start: "2026-10-19T14:40:00Z", end: "2026-10-19T15:00:00Z" }],
    });
    assert.deepEqual(slots, ["2026-10-19T14:00:00.000Z", "2026-10-19T15:30:00.000Z"]);
  });

  it("stops offering a day once it has the most calls", () => {
    const slots = computeSlots(settings({ maxPerDay: 1 }, weekdays), {
      now: at("2026-10-15T12:00:00Z"),
      booked: ["2026-10-19T14:00:00.000Z"],
    });
    assert.deepEqual(slots, []);
  });

  it("leaves out blackout dates and days past the window", () => {
    const s = settings({ blackouts: [{ start: "2026-10-19", end: "2026-10-19" }], windowDays: 11 }, weekdays);
    const slots = computeSlots(s, { now: at("2026-10-15T12:00:00Z") });
    assert.equal(slots[0], "2026-10-26T14:00:00.000Z");
    assert.equal(computeSlots(settings({ windowDays: 2 }, weekdays), { now: at("2026-10-15T12:00:00Z") }).length, 0);
  });

  it("doesn't let a booking being moved block itself", () => {
    const own = { start: "2026-10-19T14:00:00Z", end: "2026-10-19T14:20:00Z" };
    const slots = computeSlots(settings({ maxPerDay: 1 }, weekdays), {
      now: at("2026-10-15T12:00:00Z"),
      busy: [own],
      booked: [own.start],
      moving: own,
    });
    assert.equal(slots.length, 4);
  });
});

describe("buildIcs", () => {
  it("folds long lines at 75 octets and escapes text", () => {
    const ics = buildIcs({
      uid: "abc@google.com",
      sequence: 2,
      method: "REQUEST",
      start: "2026-10-19T14:00:00.000Z",
      end: "2026-10-19T14:20:00.000Z",
      summary: "Call, with; Joe",
      description: "x".repeat(200),
      organizer: { name: "Joe", email: "joe@example.com" },
      attendee: { name: "Ana", email: "ana@example.com" },
    });
    for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
    assert.match(ics, /DTSTART:20261019T140000Z/);
    assert.match(ics, /SUMMARY:Call\\, with\\; Joe/);
    assert.match(ics, /SEQUENCE:2/);
  });
});

describe("manage tokens", () => {
  it("round-trips a booking id and refuses a forged one", () => {
    const token = manageToken("bk_abcdefgh1234");
    assert.equal(bookingIdFrom(token), "bk_abcdefgh1234");
    assert.equal(bookingIdFrom(token.replace("bk_abcdefgh1234", "bk_abcdefgh9999")), null);
    assert.equal(bookingIdFrom("nonsense"), null);
  });
});

describe("bookings database", () => {
  let directory: string;
  let database: Client;

  const booking = (id: string, start: string, end: string): NewBooking => ({
    id,
    eventId: `ev${id.replace(/\W/g, "")}`,
    calendarId: "primary",
    start,
    end,
    guestName: "Ana",
    guestEmail: "ana@example.com",
    guestTimezone: "Europe/Lisbon",
    answers: { project: "A site" },
  });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "booking-"));
    database = createClient({ url: `file:${join(directory, "test.db")}` });
    await database.executeMultiple(await readFile(join(process.cwd(), "src/lib/booking/bookings.sql"), "utf8"));
    setDatabaseClient(database);
  });

  afterEach(async () => {
    setDatabaseClient(undefined);
    database.close();
    await rm(directory, { recursive: true, force: true });
  });

  const buffer = 10 * 60_000;

  it("lets only one booking hold a time", async () => {
    const a = booking("bk_aaaaaaaa", "2026-10-19T14:00:00.000Z", "2026-10-19T14:20:00.000Z");
    const b = booking("bk_bbbbbbbb", "2026-10-19T14:00:00.000Z", "2026-10-19T14:20:00.000Z");
    assert.equal(await holdSlot(a, buffer), true);
    assert.equal(await holdSlot(b, buffer), false);
  });

  it("refuses a time within the buffer of another booking", async () => {
    await holdSlot(booking("bk_aaaaaaaa", "2026-10-19T14:00:00.000Z", "2026-10-19T14:20:00.000Z"), buffer);
    const close = booking("bk_bbbbbbbb", "2026-10-19T14:25:00.000Z", "2026-10-19T14:45:00.000Z");
    assert.equal(await holdSlot(close, buffer), false);
    const clear = booking("bk_cccccccc", "2026-10-19T14:30:00.000Z", "2026-10-19T14:50:00.000Z");
    assert.equal(await holdSlot(clear, buffer), true);
  });

  it("frees a time when its hold is released, and lets an abandoned hold lapse", async () => {
    const a = booking("bk_aaaaaaaa", "2026-10-19T14:00:00.000Z", "2026-10-19T14:20:00.000Z");
    await holdSlot(a, buffer, new Date("2026-10-01T00:00:00Z"));
    // Ten minutes on, the pending hold has lapsed.
    const b = booking("bk_bbbbbbbb", "2026-10-19T14:00:00.000Z", "2026-10-19T14:20:00.000Z");
    assert.equal(await holdSlot(b, buffer, new Date("2026-10-01T00:10:00Z")), true);
    await releaseSlot(b.id);
    assert.deepEqual(await liveBookings("2026-10-01T00:00:00Z"), []);
  });

  it("moves, cancels and claims reminders once", async () => {
    const a = booking("bk_aaaaaaaa", "2026-10-19T14:00:00.000Z", "2026-10-19T14:20:00.000Z");
    await holdSlot(a, buffer);
    await confirmBooking(a.id, "uid@google.com", "https://meet.google.com/abc");
    await holdSlot(booking("bk_bbbbbbbb", "2026-10-19T16:00:00.000Z", "2026-10-19T16:20:00.000Z"), buffer);

    assert.equal(await moveBooking(a.id, "2026-10-19T16:00:00.000Z", "2026-10-19T16:20:00.000Z", buffer), false);
    assert.equal(await moveBooking(a.id, "2026-10-19T15:00:00.000Z", "2026-10-19T15:20:00.000Z", buffer), true);
    const [moved] = await confirmedBetween("2026-10-19T00:00:00.000Z", "2026-10-20T00:00:00.000Z");
    assert.equal(moved.start, "2026-10-19T15:00:00.000Z");
    assert.equal(moved.sequence, 1);

    assert.equal(await claimReminder(a.id, "hour", moved.start), true);
    assert.equal(await claimReminder(a.id, "hour", moved.start), false);

    assert.equal(await cancelBooking(a.id), true);
    assert.equal(await cancelBooking(a.id), false);
    assert.deepEqual(await confirmedBetween("2026-10-19T00:00:00.000Z", "2026-10-20T00:00:00.000Z"), []);
  });

  it("deletes bookings two years after their call, and keeps newer ones", async () => {
    await holdSlot(booking("bk_aaaaaaaa", "2024-01-10T14:00:00.000Z", "2024-01-10T14:20:00.000Z"), buffer);
    await holdSlot(booking("bk_bbbbbbbb", "2025-06-10T14:00:00.000Z", "2025-06-10T14:20:00.000Z"), buffer);
    assert.equal(await deleteOldBookings(new Date("2026-03-01T00:00:00Z")), 1);
    assert.deepEqual(await liveBookings("2020-01-01T00:00:00Z"), [
      { start: "2025-06-10T14:00:00.000Z", end: "2025-06-10T14:20:00.000Z" },
    ]);
  });
});
