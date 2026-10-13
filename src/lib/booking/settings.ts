import raw from "@/data/booking.json";

// The booking page's settings: which calendars it reads and writes, the hours
// calls can start in, the rules around them and the questions it asks. They live
// in src/data/booking.json, edited from the dev-only /admin/booking, and are
// checked here, so a bad edit fails the build rather than the booking page.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_NAMES: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** A stretch of a day calls can start in, as 24-hour "HH:MM" in the owner's timezone. */
export type Window = { start: string; end: string };

/** Dates calls can't be booked on, inclusive, as "YYYY-MM-DD" in the owner's timezone. */
export type Blackout = { start: string; end: string; label?: string };

export type Question = {
  /** Stable key for the answer, in the database and the emails. */
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  /** The choices, for a select. */
  options?: string[];
};

export type BookingSettings = {
  /** The calendar bookings are created on. */
  calendarId: string;
  /** Calendars whose events block a slot; always includes `calendarId`. */
  busyCalendarIds: string[];
  /** The owner's IANA timezone, which `weeklyHours` and `blackouts` are in. */
  timezone: string;
  /** What the call is called, on the picker and in the emails. */
  title: string;
  durationMinutes: number;
  /** How far apart start times are offered. */
  stepMinutes: number;
  /** Free time kept before and after every call and calendar event. */
  bufferMinutes: number;
  /** How soon the earliest call can be. */
  minNoticeHours: number;
  /** How many days ahead calls can be booked. */
  windowDays: number;
  /** The most calls on one day. */
  maxPerDay: number;
  weeklyHours: Record<Day, Window[]>;
  blackouts: Blackout[];
  questions: Question[];
};

/** Answers are capped at this many characters. */
export const ANSWER_MAX = 2000;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z][a-z0-9-]{0,31}$/;

/** Minutes past midnight for an "HH:MM". */
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function isTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const isDate = (value: unknown): value is string =>
  typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function wholeNumber(value: unknown, name: string, min: number, max: number) {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return value as number;
}

function text(value: unknown, name: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${name} must be text of up to ${max} characters.`);
  }
  return value;
}

/** The settings, checked; throws with a message saying what's wrong. */
export function validateBookingSettings(input: unknown): BookingSettings {
  if (!input || typeof input !== "object") throw new Error("The settings must be an object.");
  const s = input as Record<string, unknown>;

  const calendarId = text(s.calendarId, "The booking calendar", 300);
  if (!Array.isArray(s.busyCalendarIds) || !s.busyCalendarIds.every((id) => typeof id === "string")) {
    throw new Error("The busy calendars must be a list of calendar ids.");
  }
  const busy = (s.busyCalendarIds as string[]).map((id) => id.trim()).filter(Boolean);
  const busyCalendarIds = [...new Set([calendarId, ...busy])];

  const timezone = text(s.timezone, "The timezone", 100);
  if (!isTimeZone(timezone)) throw new Error(`“${timezone}” isn’t a timezone.`);

  const durationMinutes = wholeNumber(s.durationMinutes, "The call length", 5, 240);
  const stepMinutes = wholeNumber(s.stepMinutes, "The time between start times", 5, 240);
  const bufferMinutes = wholeNumber(s.bufferMinutes, "The buffer", 0, 120);
  const minNoticeHours = wholeNumber(s.minNoticeHours, "The minimum notice", 0, 24 * 14);
  const windowDays = wholeNumber(s.windowDays, "The booking window", 1, 90);
  const maxPerDay = wholeNumber(s.maxPerDay, "The daily limit", 1, 24);

  const hours = s.weeklyHours as Record<string, unknown> | undefined;
  if (!hours || typeof hours !== "object") throw new Error("The weekly hours are missing.");
  const weeklyHours = {} as Record<Day, Window[]>;
  for (const day of DAYS) {
    const windows = hours[day] ?? [];
    if (!Array.isArray(windows)) throw new Error(`The hours for ${DAY_NAMES[day]} must be a list.`);
    const checked = windows.map((w: Window) => {
      if (!w || !TIME.test(w.start) || !TIME.test(w.end)) {
        throw new Error(`The hours for ${DAY_NAMES[day]} must be 24-hour times like “09:30”.`);
      }
      if (minutesOf(w.end) <= minutesOf(w.start))
        throw new Error(`A window on ${DAY_NAMES[day]} ends before it starts.`);
      if (minutesOf(w.end) - minutesOf(w.start) < durationMinutes) {
        throw new Error(`A window on ${DAY_NAMES[day]} is shorter than a call.`);
      }
      return { start: w.start, end: w.end };
    });
    checked.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    for (let i = 1; i < checked.length; i++) {
      if (minutesOf(checked[i].start) < minutesOf(checked[i - 1].end)) {
        throw new Error(`Two windows on ${DAY_NAMES[day]} overlap.`);
      }
    }
    weeklyHours[day] = checked;
  }

  if (!Array.isArray(s.blackouts)) throw new Error("The blackout dates must be a list.");
  const blackouts = s.blackouts.map((b: Blackout) => {
    if (!b || !isDate(b.start) || !isDate(b.end)) throw new Error("Blackout dates must look like “2026-12-24”.");
    if (b.end < b.start) throw new Error(`The blackout from ${b.start} ends before it starts.`);
    if (b.label !== undefined && typeof b.label !== "string") throw new Error("A blackout’s label must be text.");
    const label = b.label?.trim();
    return label ? { start: b.start, end: b.end, label } : { start: b.start, end: b.end };
  });

  if (!Array.isArray(s.questions)) throw new Error("The questions must be a list.");
  const ids = new Set<string>(["name", "email"]);
  const questions = s.questions.map((q: Question) => {
    if (!q || typeof q.id !== "string" || !ID.test(q.id)) {
      throw new Error("Each question needs an id of lowercase letters, numbers and dashes.");
    }
    if (ids.has(q.id)) throw new Error(`Two questions use the id “${q.id}” (name and email are taken).`);
    ids.add(q.id);
    const label = text(q.label, `The label of “${q.id}”`);
    if (!["text", "textarea", "select"].includes(q.type)) throw new Error(`“${q.id}” has an unknown type.`);
    if (typeof q.required !== "boolean") throw new Error(`“${q.id}” must say whether it’s required.`);
    if (q.type !== "select") return { id: q.id, label, type: q.type, required: q.required };
    const options = Array.isArray(q.options)
      ? q.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
      : [];
    if (options.length < 2) throw new Error(`The select “${q.id}” needs at least two options.`);
    return { id: q.id, label, type: q.type, required: q.required, options };
  });

  return {
    calendarId,
    busyCalendarIds,
    timezone,
    title: text(s.title, "The call’s title", 80),
    durationMinutes,
    stepMinutes,
    bufferMinutes,
    minNoticeHours,
    windowDays,
    maxPerDay,
    weeklyHours,
    blackouts,
    questions,
  };
}

/** The settings as committed. */
export const BOOKING = validateBookingSettings(raw);

/** What the picker needs to know, without the calendar ids. */
export type PublicSettings = Pick<BookingSettings, "title" | "durationMinutes" | "timezone" | "questions">;

export const publicSettings = (s: BookingSettings): PublicSettings => ({
  title: s.title,
  durationMinutes: s.durationMinutes,
  timezone: s.timezone,
  questions: s.questions,
});
