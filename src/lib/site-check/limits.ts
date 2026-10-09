// The site check's caps, each overridable by an environment variable. Run through
// the per-IP ones in store.ts; the rest are enforced where they're needed.

function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const LIMITS = {
  /** Runs one visitor (IPv4 address or IPv6 /64) may start an hour. */
  runsPerIpPerHour: limit("SITE_CHECK_RUNS_PER_IP_HOUR", 5),
  /** Review requests one visitor may send an hour. */
  reviewsPerIpPerHour: limit("SITE_CHECK_REVIEWS_PER_IP_HOUR", 3),
  /** Runs across all visitors a day. */
  runsPerDay: limit("SITE_CHECK_RUNS_PER_DAY", 500),
  /** Runs of one host an hour, so no one else's site gets hammered. */
  runsPerHostPerHour: limit("SITE_CHECK_RUNS_PER_HOST_HOUR", 3),
  /** Runs under way at once. */
  maxConcurrent: limit("SITE_CHECK_MAX_CONCURRENT", 5),
} as const;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** A small number as a word, for copy. */
export const spell = (n: number) => WORDS[n] ?? String(n);
