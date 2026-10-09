import "server-only";

import { type Client, createClient } from "@libsql/client/http";
import { verdictFor } from "@/data/site-check";
import { logEvent, reasonOf } from "./log";
import type { SiteCheckRun } from "./schema";

export const SITE_CHECK_RESULTS_SCHEMA_VERSION = 1;
export const SITE_CHECK_CHECKER_VERSION = "1";
export const UNCONFIRMED_RUN_RETENTION_DAYS = 90;
export const CONFIRMED_REVIEW_RETENTION_DAYS = 2 * 365;

let client: Client | null | undefined;

/** Swaps the connection, so tests can run against a local database. */
export function setDatabaseClient(next: Client | null | undefined) {
  client = next;
}

function databaseClient() {
  if (client !== undefined) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url && !authToken) {
    client = null;
    return client;
  }
  if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together");
  client = createClient({
    url,
    authToken,
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
  });
  return client;
}

async function safely<T>(what: string, fallback: T, operation: (database: Client) => Promise<T>): Promise<T> {
  try {
    const database = databaseClient();
    if (!database) return fallback;
    return await operation(database);
  } catch (error) {
    logEvent("fail-open", { reason: `Turso failed to ${what}: ${reasonOf(error)}` });
    return fallback;
  }
}

/** Saves one newly completed check. The run id makes retries idempotent. */
export async function saveSiteCheckRun(run: SiteCheckRun) {
  if (run.status !== "complete" || run.score === null || run.duration === null || !run.finishedAt) return false;
  const { duration, finishedAt, score } = run;
  return safely("save a completed run", false, async (database) => {
    const result = await database.execute({
      sql: `INSERT INTO site_check_runs
        (id, url, host, checked_at, duration, score, verdict, schema_version, checker_version, results_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`,
      args: [
        run.id,
        run.url,
        run.host,
        finishedAt,
        duration,
        score,
        verdictFor(score),
        SITE_CHECK_RESULTS_SCHEMA_VERSION,
        SITE_CHECK_CHECKER_VERSION,
        JSON.stringify(run),
      ],
    });
    return result.rowsAffected === 1;
  });
}

/**
 * Adds the confirmed address after the one-time Redis token has been consumed. A replayed run is
 * shared by everyone who checks that host within 15 minutes, so a run can have several requests:
 * one per address, and confirming the same address again changes nothing.
 */
export async function saveConfirmedReview(runId: string, email: string, confirmedAt = new Date().toISOString()) {
  return safely("save a confirmed review", false, async (database) => {
    const result = await database.execute({
      sql: `INSERT INTO review_requests (id, run_id, email, confirmed_at, status)
        SELECT ?, id, ?, ?, 'confirmed' FROM site_check_runs WHERE id = ?
        ON CONFLICT (run_id, email) DO NOTHING`,
      args: [`review_${crypto.randomUUID()}`, email.toLowerCase(), confirmedAt, runId],
    });
    if (result.rowsAffected === 0 && !(await hasReview(database, runId, email))) {
      throw new Error(`completed run ${runId} is not in Turso`);
    }
    return result.rowsAffected === 1;
  });
}

async function hasReview(database: Client, runId: string, email: string) {
  const result = await database.execute({
    sql: "SELECT 1 FROM review_requests WHERE run_id = ? AND email = ?",
    args: [runId, email.toLowerCase()],
  });
  return result.rows.length > 0;
}

/** Retention primitive for a future scheduled task; this module does not schedule it. */
export async function cleanupExpiredSiteCheckData(now = new Date()) {
  const unconfirmedBefore = new Date(now.getTime() - UNCONFIRMED_RUN_RETENTION_DAYS * 86_400_000).toISOString();
  const confirmedBefore = new Date(now.getTime() - CONFIRMED_REVIEW_RETENTION_DAYS * 86_400_000).toISOString();
  return safely("clean up expired records", { reviewsDeleted: 0, runsDeleted: 0 }, async (database) => {
    const [reviews, runs] = await database.batch(
      [
        { sql: "DELETE FROM review_requests WHERE confirmed_at < ?", args: [confirmedBefore] },
        {
          sql: `DELETE FROM site_check_runs
              WHERE checked_at < ?
              AND NOT EXISTS (
                SELECT 1 FROM review_requests WHERE review_requests.run_id = site_check_runs.id
              )`,
          args: [unconfirmedBefore],
        },
      ],
      "write",
    );
    return { reviewsDeleted: reviews.rowsAffected, runsDeleted: runs.rowsAffected };
  });
}
