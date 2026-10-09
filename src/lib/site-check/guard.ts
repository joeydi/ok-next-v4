import { SITE } from "@/data/site";

// Refuses POSTs that didn't come from a page on this site, before any work: a
// browser always sends Origin (or at least Referer) with a fetch from our pages.
// It isn't authentication, since other clients can set the header, but it stops
// casual embedding of the endpoints from other sites.

const site = new URL(SITE.url).hostname;

function allowedHosts() {
  const hosts = new Set([site, `www.${site}`]);
  if (process.env.VERCEL_ENV === "preview") {
    for (const host of [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]) if (host) hosts.add(host);
  }
  return hosts;
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

function allowed(source: string) {
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return false;
  }
  if (process.env.NODE_ENV !== "production" && LOCAL.has(parsed.hostname)) return true;
  return parsed.protocol === "https:" && allowedHosts().has(parsed.hostname);
}

/** A 403 `{ error: "bad-origin" }` if the request didn't come from this site, otherwise null. */
export function checkOrigin(request: Request) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (source && allowed(source)) return null;
  console.warn(`[site check] bad-origin: ${source ?? "no Origin or Referer"}`);
  return Response.json({ error: "bad-origin" }, { status: 403 });
}
