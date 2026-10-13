import { type BookingSettings, DAYS, minutesOf } from "./settings";

// Turns the booking settings and the calendar's busy times into the start times a
// visitor can pick. Pure, so it runs the same in the API, the admin's preview and
// the tests. Times go in and out as UTC; the weekly hours and blackouts are read
// in the owner's timezone, with the offset looked up per moment so a daylight
// saving change lands on the right day.

/** A stretch of time, as ISO strings, the way Google's free/busy answers. */
export type Busy = { start: string; end: string };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(zone, f);
  }
  return f;
}

/** The wall-clock date and minutes past midnight in `zone` at `ms`. */
export function wallClock(ms: number, zone: string) {
  const parts: Record<string, string> = {};
  for (const p of formatter(zone).formatToParts(ms)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}

/** How far `zone` is ahead of UTC at `ms`, in milliseconds. */
function offset(ms: number, zone: string) {
  const { date, minutes, seconds } = wallClock(ms, zone);
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, minutes, seconds) - Math.floor(ms / 1000) * 1000;
}

/** The moment `zone`'s clocks read `date` at `minutes` past midnight, or null if they never do (a spring-forward gap). */
export function zonedTime(date: string, minutes: number, zone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let ms = guess - offset(guess, zone);
  const second = guess - offset(ms, zone);
  if (second !== ms) ms = second;
  const back = wallClock(ms, zone);
  return back.date === date && back.minutes === minutes ? ms : null;
}

/** "YYYY-MM-DD" `days` after `date`. */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The settings' key for the weekday of a "YYYY-MM-DD". */
export function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return DAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** The span to ask the calendar about: from now until the end of the booking window, with a day either side. */
export function availabilityRange(settings: BookingSettings, now = Date.now()) {
  return {
    timeMin: new Date(now - DAY).toISOString(),
    timeMax: new Date(now + (settings.windowDays + 2) * DAY).toISOString(),
  };
}

export type SlotInput = {
  now?: number;
  /** Calendar events, from free/busy. */
  busy?: Busy[];
  /** Start times of confirmed bookings, for the daily limit. */
  booked?: string[];
  /** A booking being moved: its own time doesn't block its new one, nor count towards its day. */
  moving?: Busy;
};

/** Every start time a call can be booked at, ascending, as ISO strings. */
export function computeSlots(settings: BookingSettings, input: SlotInput = {}) {
  const { timezone: zone, durationMinutes, stepMinutes, bufferMinutes } = settings;
  const now = input.now ?? Date.now();
  const earliest = now + settings.minNoticeHours * HOUR;
  const moving = input.moving && { start: Date.parse(input.moving.start), end: Date.parse(input.moving.end) };
  const busy = (input.busy ?? [])
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => !(moving && b.start === moving.start && b.end === moving.end))
    .sort((a, b) => a.start - b.start);

  const perDay = new Map<string, number>();
  for (const start of input.booked ?? []) {
    const ms = Date.parse(start);
    if (moving && ms === moving.start) continue;
    const day = wallClock(ms, zone).date;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const today = wallClock(now, zone).date;
  const slots: string[] = [];
  for (let i = 0; i <= settings.windowDays; i++) {
    const date = addDays(today, i);
    if (settings.blackouts.some((b) => date >= b.start && date <= b.end)) continue;
    if ((perDay.get(date) ?? 0) >= settings.maxPerDay) continue;
    for (const window of settings.weeklyHours[weekday(date)]) {
      const end = minutesOf(window.end);
      for (let minutes = minutesOf(window.start); minutes + durationMinutes <= end; minutes += stepMinutes) {
        const start = zonedTime(date, minutes, zone);
        if (start === null || start < earliest) continue;
        const from = start - bufferMinutes * MINUTE;
        const to = start + (durationMinutes + bufferMinutes) * MINUTE;
        if (busy.some((b) => b.start < to && b.end > from)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
  }
  return slots;
}

/** Whether `start` is one of the times `computeSlots` offers. */
export const isBookable = (settings: BookingSettings, start: string, input: SlotInput = {}) =>
  computeSlots(settings, input).includes(new Date(start).toISOString());
