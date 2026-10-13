import "server-only";

import { type Client, createClient } from "@libsql/client/http";

// The Turso connection the site check and the booking page share. It's made on
// first use from TURSO_DATABASE_URL and TURSO_AUTH_TOKEN; without both it's null,
// and each caller decides what that means (the site check carries on unsaved).

let client: Client | null | undefined;

/** Swaps the connection, so tests can run against a local database. */
export function setDatabaseClient(next: Client | null | undefined) {
  client = next;
}

export function databaseClient() {
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
