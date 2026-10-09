import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client/http";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required to run site-check migrations.");
}

const client = createClient({ url, authToken });
const migration = fileURLToPath(new URL("../migrations/001_site_check_storage.sql", import.meta.url));

try {
  await client.executeMultiple(await readFile(migration, "utf8"));
  console.log("Applied site-check migration 001.");
} finally {
  client.close();
}
