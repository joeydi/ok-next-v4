import { createHash } from "node:crypto";

// One JSON line per notable thing the site check does, for Vercel's log search
// (filter on `"site-check"` or an event name). It never logs an email address or a
// full IP: visitors appear as `ip`, a short hash of their rate-limit key, which is
// enough to see one visitor repeating without saying who they are.

export type LogEvent =
  | "rate-limited"
  | "host-capped"
  | "day-capped"
  | "busy"
  | "bot-check-failed"
  | "bad-origin"
  | "bad-email"
  | "disposable-email"
  | "no-mail-server"
  | "email-limit"
  | "review-requested"
  | "review-confirmed"
  | "fail-open"
  | "error";

type Fields = {
  host?: string;
  /** A visitor's rate-limit key (see `ipKey` in store.ts), hashed before it's logged. */
  ip?: string;
  /** An email's domain, never the address. */
  domain?: string;
  reason?: string;
};

const WARN = new Set<LogEvent>(["fail-open", "error"]);

const hash = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 8);

export function logEvent(event: LogEvent, { ip, ...fields }: Fields = {}) {
  const line = JSON.stringify({ source: "site-check", event, ...fields, ...(ip && { ip: hash(ip) }) });
  if (event === "error") console.error(line);
  else if (WARN.has(event)) console.warn(line);
  else console.log(line);
}

/** An error's message, cut short, for a log line. */
export const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 200);
