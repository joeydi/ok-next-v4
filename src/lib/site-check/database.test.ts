import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type Client, createClient } from "@libsql/client";
import { cleanupExpiredSiteCheckData, saveConfirmedReview, saveSiteCheckRun, setDatabaseClient } from "./database";
import type { SiteCheckRun } from "./schema";

// Runs against a throwaway local libSQL file, with the same migrations as production. ok-next-admin
// owns the schema, so it has to be checked out next to this repo. The SQL is read at runtime rather
// than imported, so the build, which typechecks this file without the admin, doesn't need it.
const migrations = join(process.cwd(), "../ok-next-admin/migrations");

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
  for (const name of (await readdir(migrations)).filter((f) => f.endsWith(".sql")).sort()) {
    await database.executeMultiple(await readFile(join(migrations, name), "utf8"));
  }
  setDatabaseClient(database);
});

afterEach(async () => {
  setDatabaseClient(undefined);
  database.close();
  await rm(directory, { recursive: true, force: true });
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
