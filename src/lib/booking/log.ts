import { createHash } from "node:crypto";

// One JSON line per notable thing the booking flow does, for Vercel's log search
// (filter on `"booking"`). Like the site check's, it never logs an address or a
// full IP: an email appears as its domain, a visitor as a short hash.

export type BookingEvent =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "slot-taken"
  | "rate-limited"
  | "email-limit"
  | "bad-email"
  | "disposable-email"
  | "no-mail-server"
  | "reminders"
  | "error";

type Fields = { ip?: string; domain?: string; reason?: string; sent?: number };

const hash = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 8);

export function bookingLog(event: BookingEvent, { ip, ...fields }: Fields = {}) {
  const line = JSON.stringify({ source: "booking", event, ...fields, ...(ip && { ip: hash(ip) }) });
  if (event === "error") console.error(line);
  else console.log(line);
}

export { reasonOf } from "@/lib/site-check/log";
