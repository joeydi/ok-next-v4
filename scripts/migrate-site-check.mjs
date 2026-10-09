import { createClient } from "@libsql/client/http";
import { applyMigrations } from "./site-check-migrations.mjs";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required to run site-check migrations.");
}

const client = createClient({ url, authToken });

try {
  await applyMigrations(client);
} finally {
  client.close();
}
