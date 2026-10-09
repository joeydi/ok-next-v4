import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../migrations/", import.meta.url));

/** Applies every migrations/*.sql file the database hasn't recorded yet, in filename order. */
export async function applyMigrations(client, log = console.log) {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set((await client.execute("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
  const pending = (await readdir(directory)).filter((name) => name.endsWith(".sql") && !applied.has(name)).sort();
  for (const name of pending) {
    // Each file wraps its own changes in a transaction where they need one.
    await client.executeMultiple(await readFile(`${directory}${name}`, "utf8"));
    await client.execute({
      sql: "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
      args: [name, new Date().toISOString()],
    });
    log(`Applied ${name}.`);
  }
  if (!pending.length) log("Site-check schema is up to date.");
  return pending;
}
