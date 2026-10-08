import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { SiteCheckRun } from "./schema";

// The checker's state, in Upstash Redis (the Vercel Marketplace integration sets
// KV_REST_API_URL and KV_REST_API_TOKEN): rate limits, a lock so one host isn't
// checked twice at once, a short cache of each host's last run, and every run for
// 30 days so a review request can point at its evidence. Without those variables
// (local development) it falls back to memory and doesn't rate limit. If Redis
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
    console.error(`[site check] Redis failed to ${what}`, error);
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
};

const limiters = redis && {
  run: new Ratelimit({ redis, prefix: "sc:rl:run", limiter: Ratelimit.slidingWindow(5, "1 h"), timeout: 3000 }),
  review: new Ratelimit({ redis, prefix: "sc:rl:review", limiter: Ratelimit.slidingWindow(3, "1 h"), timeout: 3000 }),
};

/** Whether `ip` has a run left this hour (5), without spending it. */
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

/** Whether `ip` may send another review request (3 an hour), spending one if so. */
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

/** The visitor's address, as Vercel passes it on. */
export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
