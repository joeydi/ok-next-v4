import "server-only";

import { type Client, createClient, type Row } from "@libsql/client/http";
import { verdictFor } from "@/data/site-check";
import { logEvent, reasonOf } from "./log";
import type { SiteCheckRun } from "./schema";

export const SITE_CHECK_RESULTS_SCHEMA_VERSION = 1;
export const SITE_CHECK_CHECKER_VERSION = "1";
export const UNCONFIRMED_RUN_RETENTION_DAYS = 90;
export const CONFIRMED_REVIEW_RETENTION_DAYS = 2 * 365;

export type ReviewStatus = "confirmed" | "in_progress" | "report_sent" | "closed";

export type StoredSiteCheckRun = {
  id: string;
  url: string;
  host: string;
  checkedAt: string;
  duration: number;
  score: number;
  verdict: string;
  schemaVersion: number;
  checkerVersion: string;
  run: SiteCheckRun;
  createdAt: string;
};

export type StoredReviewRequest = {
  id: string;
  runId: string;
  email: string;
  confirmedAt: string;
  status: ReviewStatus;
  privateNotes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  host: string;
  url: string;
  score: number;
  checkedAt: string;
};

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

const text = (row: Row, key: string) => String(row[key]);
const optionalText = (row: Row, key: string) => (row[key] === null ? null : String(row[key]));
const number = (row: Row, key: string) => Number(row[key]);

const storedRun = (row: Row): StoredSiteCheckRun => ({
  id: text(row, "id"),
  url: text(row, "url"),
  host: text(row, "host"),
  checkedAt: text(row, "checked_at"),
  duration: number(row, "duration"),
  score: number(row, "score"),
  verdict: text(row, "verdict"),
  schemaVersion: number(row, "schema_version"),
  checkerVersion: text(row, "checker_version"),
  run: JSON.parse(text(row, "results_json")) as SiteCheckRun,
  createdAt: text(row, "created_at"),
});

const storedReview = (row: Row): StoredReviewRequest => ({
  id: text(row, "id"),
  runId: text(row, "run_id"),
  email: text(row, "email"),
  confirmedAt: text(row, "confirmed_at"),
  status: text(row, "status") as ReviewStatus,
  privateNotes: optionalText(row, "private_notes"),
  completedAt: optionalText(row, "completed_at"),
  createdAt: text(row, "created_at"),
  updatedAt: text(row, "updated_at"),
  host: text(row, "host"),
  url: text(row, "url"),
  score: number(row, "score"),
  checkedAt: text(row, "checked_at"),
});

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

export async function updateReviewStatus(
  runId: string,
  status: ReviewStatus,
  options: { privateNotes?: string | null; completedAt?: string | null } = {},
) {
  const now = new Date().toISOString();
  const hasNotes = Object.hasOwn(options, "privateNotes");
  const hasCompletedAt = Object.hasOwn(options, "completedAt");
  const completedAt = hasCompletedAt
    ? (options.completedAt ?? null)
    : status === "report_sent" || status === "closed"
      ? now
      : null;
  return safely("update a review status", false, async (database) => {
    const result = await database.execute({
      sql: `UPDATE review_requests SET
        status = ?,
        private_notes = CASE WHEN ? THEN ? ELSE private_notes END,
        completed_at = CASE WHEN ? OR ? IS NOT NULL THEN ? ELSE completed_at END,
        updated_at = ?
        WHERE run_id = ?`,
      args: [
        status,
        hasNotes ? 1 : 0,
        options.privateNotes ?? null,
        hasCompletedAt ? 1 : 0,
        completedAt,
        completedAt,
        now,
        runId,
      ],
    });
    return result.rowsAffected === 1;
  });
}

export async function getSiteCheckRun(id: string) {
  return safely<StoredSiteCheckRun | null>("read a completed run", null, async (database) => {
    const result = await database.execute({ sql: "SELECT * FROM site_check_runs WHERE id = ?", args: [id] });
    return result.rows[0] ? storedRun(result.rows[0]) : null;
  });
}

export async function listReviewRequests({
  status,
  limit = 50,
  offset = 0,
}: {
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
} = {}) {
  const pageSize = Math.min(100, Math.max(1, Math.floor(limit)));
  const pageOffset = Math.max(0, Math.floor(offset));
  return safely<StoredReviewRequest[]>("list review requests", [], async (database) => {
    const where = status ? "WHERE review_requests.status = ?" : "";
    const args = status ? [status, pageSize, pageOffset] : [pageSize, pageOffset];
    const result = await database.execute({
      sql: `SELECT review_requests.*, site_check_runs.host, site_check_runs.url,
        site_check_runs.score, site_check_runs.checked_at
        FROM review_requests
        JOIN site_check_runs ON site_check_runs.id = review_requests.run_id
        ${where}
        ORDER BY review_requests.updated_at DESC, review_requests.id DESC
        LIMIT ? OFFSET ?`,
      args,
    });
    return result.rows.map(storedReview);
  });
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
