import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type Client, createClient } from "@libsql/client";
import { applyMigrations } from "../../../scripts/site-check-migrations.mjs";
import { cleanupExpiredSiteCheckData, saveConfirmedReview, saveSiteCheckRun, setDatabaseClient } from "./database";
import type { SiteCheckRun } from "./schema";

// Runs against a throwaway local libSQL file, with the same migrations as production.

let directory: string;
let database: Client;

const run = (id: string, finishedAt = new Date().toISOString()) =>
  ({
    id,
    status: "complete",
    url: "https://example.com/",
    host: "example.com",
    startedAt: finishedAt,
    finishedAt,
    duration: 12_000,
    score: 82,
    results: [],
    categories: [],
  }) as unknown as SiteCheckRun;

const count = async (table: string) => Number((await database.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "site-check-"));
  database = createClient({ url: `file:${join(directory, "test.db")}` });
  await applyMigrations(database, () => {});
  setDatabaseClient(database);
});

afterEach(async () => {
  setDatabaseClient(undefined);
  database.close();
  await rm(directory, { recursive: true, force: true });
});

describe("migrations", () => {
  it("record what they applied and do nothing the second time", async () => {
    assert.deepEqual(await applyMigrations(database, () => {}), []);
    assert.equal(await count("schema_migrations"), 2);
  });
});

describe("migration 002", () => {
  it("keeps reviews saved under the first schema", async () => {
    const old = createClient({ url: `file:${join(directory, "old.db")}` });
    await old.executeMultiple(await readFile("migrations/001_site_check_storage.sql", "utf8"));
    await old.executeMultiple(`
      INSERT INTO site_check_runs (id, url, host, checked_at, duration, score, verdict, schema_version, checker_version, results_json)
        VALUES ('sc_old', 'https://example.com/', 'example.com', '2026-01-01T00:00:00Z', 1, 50, 'ok', 1, '1', '{}');
      INSERT INTO review_requests (id, run_id, email, confirmed_at) VALUES ('review_sc_old', 'sc_old', 'A@Example.com', '2026-01-01T00:00:00Z');
    `);
    assert.deepEqual(await applyMigrations(old, () => {}), [
      "001_site_check_storage.sql",
      "002_review_requests_per_email.sql",
    ]);
    const rows = (await old.execute("SELECT id, email FROM review_requests")).rows;
    assert.deepEqual(
      rows.map((r) => [r.id, r.email]),
      [["review_sc_old", "a@example.com"]],
    );
    old.close();
  });
});

describe("saveSiteCheckRun", () => {
  it("stores a completed run once", async () => {
    assert.equal(await saveSiteCheckRun(run("sc_1")), true);
    assert.equal(await saveSiteCheckRun(run("sc_1")), false);
    assert.equal(await count("site_check_runs"), 1);
  });

  it("ignores a run that didn't complete", async () => {
    assert.equal(await saveSiteCheckRun({ ...run("sc_2"), status: "failed" } as unknown as SiteCheckRun), false);
    assert.equal(await count("site_check_runs"), 0);
  });
});

describe("saveConfirmedReview", () => {
  it("needs its run to be stored first", async () => {
    assert.equal(await saveConfirmedReview("sc_missing", "a@example.com"), false);
    assert.equal(await count("review_requests"), 0);
  });

  it("stores the first confirmation and treats a repeat as already done", async () => {
    await saveSiteCheckRun(run("sc_3"));
    assert.equal(await saveConfirmedReview("sc_3", "a@example.com"), true);
    assert.equal(await saveConfirmedReview("sc_3", "A@Example.com"), false);
    assert.equal(await count("review_requests"), 1);
  });

  it("keeps every visitor's address when they share a replayed run", async () => {
    await saveSiteCheckRun(run("sc_4"));
    await saveConfirmedReview("sc_4", "first@example.com");
    await saveConfirmedReview("sc_4", "second@example.com");
    const emails = (await database.execute("SELECT email FROM review_requests ORDER BY email")).rows.map(
      (r) => r.email,
    );
    assert.deepEqual(emails, ["first@example.com", "second@example.com"]);
  });
});

describe("cleanupExpiredSiteCheckData", () => {
  it("removes old unconfirmed runs but keeps confirmed ones until their own period ends", async () => {
    const day = 86_400_000;
    const now = new Date();
    await saveSiteCheckRun(run("sc_old", new Date(now.getTime() - 100 * day).toISOString()));
    await saveSiteCheckRun(run("sc_reviewed", new Date(now.getTime() - 100 * day).toISOString()));
    await saveSiteCheckRun(run("sc_new"));
    await saveConfirmedReview("sc_reviewed", "a@example.com", new Date(now.getTime() - 100 * day).toISOString());

    assert.deepEqual(await cleanupExpiredSiteCheckData(now), { reviewsDeleted: 0, runsDeleted: 1 });
    assert.equal(await count("site_check_runs"), 2);

    const later = new Date(now.getTime() + 2 * 365 * day);
    assert.deepEqual(await cleanupExpiredSiteCheckData(later), { reviewsDeleted: 1, runsDeleted: 2 });
    assert.equal(await count("site_check_runs"), 0);
  });
});
