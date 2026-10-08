import type { CheckData, CheckId, CheckResult, CheckStatus } from "../schema";

// What every check returns before the run stamps it with its id and timing. Each
// check scores itself out of 100 (its rubric sits beside it); the status follows
// the score unless the check says otherwise.

export type Finding<Id extends CheckId = CheckId> = Pick<
  Extract<CheckResult, { id: Id }>,
  "status" | "score" | "summary" | "value" | "data"
>;

export const statusFor = (score: number): CheckStatus => (score >= 90 ? "ok" : score >= 50 ? "warn" : "fail");

/** A finding whose status follows its score. */
export function scored<Id extends CheckId>(
  score: number,
  summary: string,
  data: CheckData[Id],
  value: string | null = null,
  status: CheckStatus = statusFor(score),
): Finding<Id> {
  return { status, score: Math.max(0, Math.min(100, Math.round(score))), summary, value, data } as Finding<Id>;
}

/** A finding that doesn't count towards the score: the check didn't apply, or there was nothing to judge. */
export function skipped<Id extends CheckId>(
  summary: string,
  data: CheckData[Id] | null = null,
  status: CheckStatus = "skipped",
): Finding<Id> {
  return { status, score: null, summary, value: null, data } as Finding<Id>;
}

export const DAY = 86_400_000;

export const daysUntil = (iso: string) => Math.floor((Date.parse(iso) - Date.now()) / DAY);

/** "1.8 MB", "640 KB". */
export function bytes(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

/** "1 plugin", "3 plugins". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Compares dotted versions: negative when `a` is older than `b`. */
export function compareVersions(a: string, b: string) {
  const pa = a.split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0);
  const pb = b.split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
