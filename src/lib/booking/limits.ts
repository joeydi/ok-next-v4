import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { bookingLog, reasonOf } from "./log";

// The booking routes' per-visitor limits, in the same Upstash Redis as the site
// check. Without it (local development) there are none, and if Redis fails the
// request goes through, as the site check's do.

function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const BOOKING_LIMITS = {
  /** Times one visitor may load the free slots an hour. */
  slotsPerIpPerHour: limit("BOOKING_SLOTS_PER_IP_HOUR", 60),
  /** Bookings, moves and cancellations one visitor may make an hour. */
  changesPerIpPerHour: limit("BOOKING_CHANGES_PER_IP_HOUR", 6),
  /** Calls one email address may have coming up at once. */
  upcomingPerEmail: limit("BOOKING_UPCOMING_PER_EMAIL", 2),
} as const;

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const redis =
  url && token ? new Redis({ url, token, retry: { retries: 1 }, signal: () => AbortSignal.timeout(3000) }) : null;

const limiters = redis && {
  slots: new Ratelimit({
    redis,
    prefix: "bk:rl:slots",
    limiter: Ratelimit.slidingWindow(BOOKING_LIMITS.slotsPerIpPerHour, "1 h"),
    timeout: 3000,
  }),
  change: new Ratelimit({
    redis,
    prefix: "bk:rl:change",
    limiter: Ratelimit.slidingWindow(BOOKING_LIMITS.changesPerIpPerHour, "1 h"),
    timeout: 3000,
  }),
};

/** Whether `ip` may make another request of this kind, spending one if so. */
export async function allow(kind: "slots" | "change", ip: string) {
  if (!limiters) return true;
  try {
    return (await limiters[kind].limit(ip)).success;
  } catch (error) {
    bookingLog("error", { reason: `Redis failed to rate limit: ${reasonOf(error)}` });
    return true;
  }
}
