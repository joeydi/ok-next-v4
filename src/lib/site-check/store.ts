import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { LIMITS } from "./limits";
import type { SiteCheckRun } from "./schema";

// The checker's state, in Upstash Redis (the Vercel Marketplace integration sets
// KV_REST_API_URL and KV_REST_API_TOKEN): rate limits, the daily and per-host run
// caps, a semaphore on runs under way, a lock so one host isn't
// checked twice at once, a short cache of each host's last run, and every run for
// 30 days so a review request can point at its evidence. Without those variables
// (local development) it falls back to memory and doesn't rate limit per visitor. If Redis
// fails or is slow, the error is logged and the check carries on: it runs
// unlimited, uncached and unsaved rather than not at all.

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const redis =
  url && token ? new Redis({ url, token, retry: { retries: 1 }, signal: () => AbortSignal.timeout(3000) }) : null;

/** `fn`'s result, or `fallback` (and a log line) if Redis fails. */
async function safely<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[site check] fail-open: Redis failed to ${what}`, error);
    return fallback;
  }
}

/** How long a finished run is replayed instead of checking the host again. */
const CACHE_S = 15 * 60;
/** How long a run is kept for a review request. */
const KEEP_S = 30 * 24 * 60 * 60;
/** Longer than a run can take, so a lock can't outlive a crashed one for long. */
const LOCK_S = 100;

// On globalThis, since each route handler can get its own copy of this module in development.
type Held = Map<string, { value: unknown; until: number }>;
const memory: Held = ((globalThis as { siteCheckMemory?: Held }).siteCheckMemory ??= new Map());
const mem = {
  get: <T>(key: string) => {
    const hit = memory.get(key);
    return hit && hit.until > Date.now() ? (hit.value as T) : null;
  },
  set: (key: string, value: unknown, seconds: number) => memory.set(key, { value, until: Date.now() + seconds * 1000 }),
  take: <T>(key: string) => {
    const value = mem.get<T>(key);
    memory.delete(key);
    return value;
  },
};

const limiters = redis && {
  run: new Ratelimit({
    redis,
    prefix: "sc:rl:run",
    limiter: Ratelimit.slidingWindow(LIMITS.runsPerIpPerHour, "1 h"),
    timeout: 3000,
  }),
  review: new Ratelimit({
    redis,
    prefix: "sc:rl:review",
    limiter: Ratelimit.slidingWindow(LIMITS.reviewsPerIpPerHour, "1 h"),
    timeout: 3000,
  }),
};

/** Whether `ip` has a run left this hour, without spending it. */
export async function hasRunLeft(ip: string) {
  if (!limiters) return true;
  const limiter = limiters.run;
  return safely("read a rate limit", true, async () => (await limiter.getRemaining(ip)).remaining > 0);
}

/** Spends one of `ip`'s runs. Called once the site has answered, so a typo or a site that's down costs nothing. */
export async function countRun(ip: string) {
  if (!limiters) return;
  const limiter = limiters.run;
  await safely("count a run", null, async () => {
    await limiter.limit(ip);
    return null;
  });
}

/** Whether `ip` may send another review request, spending one if so. */
export async function allowReview(ip: string) {
  if (!limiters) return true;
  const limiter = limiters.review;
  return safely("rate limit", true, async () => (await limiter.limit(ip)).success);
}

/** Claims `host` for a run; false if another run of it is under way. */
export async function lockHost(host: string) {
  const key = `sc:lock:${host}`;
  if (!redis) {
    if (mem.get(key)) return false;
    mem.set(key, 1, LOCK_S);
    return true;
  }
  return safely("lock a host", true, async () => (await redis.set(key, 1, { nx: true, ex: LOCK_S })) === "OK");
}

export async function unlockHost(host: string) {
  const key = `sc:lock:${host}`;
  if (redis) await safely("unlock a host", 0, () => redis.del(key));
  else memory.delete(key);
}

/** Seconds in an hour and in a day: how long the host and daily counters live. */
const HOUR_S = 60 * 60;
const DAY_S = 2 * 24 * 60 * 60;

async function count(key: string) {
  if (!redis) return mem.get<number>(key) ?? 0;
  return (await redis.get<number>(key)) ?? 0;
}

/** Adds one to a counter that expires `seconds` after it started. */
async function bump(key: string, seconds: number) {
  if (!redis) {
    const hit = memory.get(key);
    const live = hit && hit.until > Date.now() ? hit : null;
    memory.set(key, {
      value: ((live?.value as number | undefined) ?? 0) + 1,
      until: live?.until ?? Date.now() + seconds * 1000,
    });
    return;
  }
  await redis.set(key, 0, { nx: true, ex: seconds });
  await redis.incr(key);
}

const dayKey = () => `sc:day:${new Date().toISOString().slice(0, 10)}`;
const hostKey = (host: string) => `sc:hosthr:${host}`;

/** Which cap a new run of `host` would break, if any: all of today's runs, or this host's runs in the last hour. */
export async function capReached(host: string): Promise<"day" | "host" | null> {
  return safely("read the run caps", null, async () => {
    if ((await count(dayKey())) >= LIMITS.runsPerDay) return "day";
    if ((await count(hostKey(host))) >= LIMITS.runsPerHostPerHour) return "host";
    return null;
  });
}

/** Spends a run of the day's and of `host`'s hour. Called with countRun, once the site has answered. */
export async function countCaps(host: string) {
  await safely("count a run against the caps", null, async () => {
    await bump(dayKey(), DAY_S);
    await bump(hostKey(host), HOUR_S);
    return null;
  });
}

// Runs under way, as a sorted set of run ids scored by when each one's slot lapses,
// so a run that crashed without releasing its slot can't hold it past LOCK_S.
const ACTIVE = "sc:active";
const CLAIM = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1`;

const slots: Map<string, number> = ((globalThis as { siteCheckSlots?: Map<string, number> }).siteCheckSlots ??=
  new Map());

/** A slot for a run, or null if LIMITS.maxConcurrent runs are already under way. Release it with `releaseSlot`. */
export async function claimSlot() {
  const id = crypto.randomUUID();
  const lapses = Date.now() + LOCK_S * 1000;
  if (!redis) {
    for (const [other, until] of slots) if (until <= Date.now()) slots.delete(other);
    if (slots.size >= LIMITS.maxConcurrent) return null;
    slots.set(id, lapses);
    return id;
  }
  const claimed = await safely("claim a run slot", true, async () => {
    const result = await redis.eval(CLAIM, [ACTIVE], [Date.now(), LIMITS.maxConcurrent, lapses, id, LOCK_S * 2000]);
    return result === 1;
  });
  return claimed ? id : null;
}

export async function releaseSlot(id: string) {
  if (redis) await safely("release a run slot", 0, () => redis.zrem(ACTIVE, id));
  else slots.delete(id);
}

/** Keeps a complete run for review requests, and as its host's replay for 15 minutes. */
export async function saveRun(run: SiteCheckRun) {
  if (!redis) {
    mem.set(`sc:run:${run.id}`, run, KEEP_S);
    mem.set(`sc:host:${run.host}`, run.id, CACHE_S);
    return;
  }
  await safely("save a run", null, async () => {
    await redis.set(`sc:run:${run.id}`, run, { ex: KEEP_S });
    await redis.set(`sc:host:${run.host}`, run.id, { ex: CACHE_S });
    return null;
  });
}

export async function getRun(id: string) {
  if (!redis) return mem.get<SiteCheckRun>(`sc:run:${id}`);
  return safely("read a run", null, () => redis.get<SiteCheckRun>(`sc:run:${id}`));
}

/** The host's last complete run, if it finished in the last 15 minutes. */
export async function recentRun(host: string) {
  const id = redis
    ? await safely("read a host's last run", null, () => redis.get<string>(`sc:host:${host}`))
    : mem.get<string>(`sc:host:${host}`);
  return id ? getRun(id) : null;
}

/** The address `x-forwarded-for` gave, with IPv6 collapsed to its /64 (one subscriber's whole block, so rotating within it doesn't dodge a limit). */
export function ipKey(raw: string) {
  const ip = raw.split("%")[0].toLowerCase();
  if (!ip.includes(":")) return ip;
  const mapped = ip.match(/^(?:0*:)*ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  // Expand "::" and an embedded dotted tail into eight groups, then keep the first four.
  const [head, tail = ""] = ip.split("::");
  const groups = (part: string) => (part ? part.split(":") : []);
  const first = groups(head);
  const last = groups(tail);
  const missing = 8 - first.length - last.length;
  if (ip.includes(".") || (!ip.includes("::") && first.length !== 8) || missing < 0) return ip;
  const all = [...first, ...Array(ip.includes("::") ? missing : 0).fill("0"), ...last];
  const prefix = all.slice(0, 4).map((g) => (Number.parseInt(g, 16) || 0).toString(16));
  return `${prefix.join(":")}::/64`;
}

/** The visitor's address, as Vercel passes it on, as a rate-limit key. */
export const clientIp = (request: Request) =>
  ipKey(request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown");

/** How long a confirmation link works. */
const PENDING_S = 60 * 60;
const EMAIL_DAY_S = 24 * 60 * 60;

/** A review request waiting on its confirmation link. */
export type PendingReview = { runId: string; email: string };

/** Keeps a request until its link is used or an hour passes. */
export async function savePending(token: string, pending: PendingReview) {
  const key = `sc:pending:${token}`;
  if (!redis) return mem.set(key, pending, PENDING_S);
  await redis.set(key, pending, { ex: PENDING_S });
}

/** The request behind a token, removing it so the link works once; null if it's used or expired. */
export async function takePending(token: string) {
  const key = `sc:pending:${token}`;
  if (!redis) return mem.take<PendingReview>(key);
  return safely("read a pending review", null, () => redis.getdel<PendingReview>(key));
}

/** Claims the one review request a run gets; false if it already has one. */
export async function claimReviewRun(runId: string) {
  const key = `sc:review:run:${runId}`;
  if (!redis) {
    if (mem.get(key)) return false;
    mem.set(key, 1, KEEP_S);
    return true;
  }
  return safely("claim a run", true, async () => (await redis.set(key, 1, { nx: true, ex: KEEP_S })) === "OK");
}

/** Gives a run's claim back, when its confirmation email didn't send. */
export async function releaseReviewRun(runId: string) {
  const key = `sc:review:run:${runId}`;
  if (redis) await safely("release a run", 0, () => redis.del(key));
  else memory.delete(key);
}

/** Whether `email` has a review request left today, spending one if so. */
export async function allowReviewEmail(email: string) {
  const key = `sc:review:email:${email}`;
  if (!redis) {
    const used = mem.get<number>(key) ?? 0;
    if (used >= LIMITS.reviewsPerEmailPerDay) return false;
    mem.set(key, used + 1, EMAIL_DAY_S);
    return true;
  }
  return safely("count an email", true, async () => {
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, EMAIL_DAY_S);
    return used <= LIMITS.reviewsPerEmailPerDay;
  });
}
