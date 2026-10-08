import dns from "node:dns/promises";
import type { IncomingHttpHeaders } from "node:http";
import tls from "node:tls";
import { type FetchResult, guardedLookup, isPublicAddress, safeFetch } from "./fetch";
import { daysUntil, type Finding, plural, scored, skipped } from "./score";

/** The host's addresses, or why there aren't any usable ones. */
export async function resolveHost(host: string): Promise<{ addresses: string[] } | { error: "not-found" | "private" }> {
  try {
    const found = await dns.lookup(host, { all: true });
    const addresses = [...new Set(found.map((a) => a.address))];
    if (!addresses.length) return { error: "not-found" };
    if (addresses.some((a) => !isPublicAddress(a))) return { error: "private" };
    return { addresses };
  } catch {
    return { error: "not-found" };
  }
}

/** Who serves the site, from the headers they add. Hosts with their own edge count too. */
export function detectCdn(headers: IncomingHttpHeaders): string | null {
  const server = String(headers.server ?? "").toLowerCase();
  if (headers["cf-ray"] || server === "cloudflare") return "Cloudflare";
  if (headers["x-vercel-id"]) return "Vercel";
  if (headers["x-nf-request-id"]) return "Netlify";
  if (headers["x-amz-cf-id"]) return "CloudFront";
  if (headers["x-sucuri-id"]) return "Sucuri";
  if (headers["x-kinsta-cache"] || headers["ki-cache-type"]) return "Kinsta";
  if (headers["x-pantheon-styx-hostname"]) return "Pantheon";
  if (headers["wpe-backend"] || headers["x-wpe-request-id"]) return "WP Engine";
  if (headers["x-github-request-id"]) return "GitHub Pages";
  if (server.includes("akamai")) return "Akamai";
  if (headers["x-served-by"] && String(headers["x-served-by"]).includes("cache-")) return "Fastly";
  return null;
}

/** Also says where the site went, if the home page redirects to another domain: every other check reads that one. */
export function checkDns(addresses: string[], home: FetchResult, host: string): Finding<"dns"> {
  const cdn = detectCdn(home.headers);
  const finalHost = new URL(home.url).hostname;
  const bare = (h: string) => h.replace(/^www\./, "");
  const moved = bare(finalHost) !== bare(host) ? `, and redirects to ${finalHost}` : "";
  const summary = `Resolves to ${plural(addresses.length, "address", "addresses")}${cdn ? `, served through ${cdn}` : ""}${moved}`;
  return { ...skipped<"dns">(summary, { addresses, cdn }), status: "ok" };
}

function certificate(host: string) {
  return new Promise<{ valid: boolean; issuer: string | null; expiresAt: string | null }>((resolve, reject) => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      lookup: guardedLookup,
      timeout: 6000,
    });
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const issuer = cert.issuer?.O ?? cert.issuer?.CN ?? null;
      resolve({
        valid: socket.authorized,
        issuer: Array.isArray(issuer) ? issuer[0] : issuer,
        expiresAt: cert.valid_to ? new Date(cert.valid_to).toISOString() : null,
      });
      socket.end();
    });
    socket.once("timeout", () => socket.destroy(new Error("TLS handshake timed out")));
    socket.once("error", reject);
  });
}

/**
 * The certificate, and whether plain http:// is sent on to https://.
 * Rubric: invalid or expired 0 · under 3 weeks left, or no redirect 60 · else 100.
 */
export async function checkHttps(host: string): Promise<Finding<"https">> {
  const [cert, plain] = await Promise.allSettled([
    certificate(host),
    safeFetch(`http://${host}/`, { method: "GET", maxBytes: 1, timeoutMs: 6000, maxRedirects: 0 }),
  ]);
  // Only the first hop matters: where it goes after reaching https:// is the home page's business.
  const location = plain.status === "fulfilled" ? String(plain.value.headers.location ?? "") : "";
  const redirects = location.startsWith("https://");
  if (cert.status === "rejected") {
    return scored(0, "No working HTTPS: the secure connection failed", {
      valid: false,
      issuer: null,
      expiresAt: null,
      daysLeft: null,
      redirects,
    });
  }
  const { valid, issuer, expiresAt } = cert.value;
  const daysLeft = expiresAt ? daysUntil(expiresAt) : null;
  const data = { valid, issuer, expiresAt, daysLeft, redirects };
  if (daysLeft !== null && daysLeft < 0) return scored(0, "The SSL certificate has expired", data, "expired");
  if (!valid) return scored(0, "The SSL certificate isn’t trusted by browsers", data, "invalid");
  const left = daysLeft === null ? "" : `, renews in ${plural(daysLeft, "day")}`;
  if (daysLeft !== null && daysLeft < 21) return scored(60, `Certificate expires in ${plural(daysLeft, "day")}`, data);
  if (!redirects) return scored(60, `Certificate valid${left}, but http://${host} doesn’t redirect to https://`, data);
  return scored(100, `Certificate valid${left}`, data, daysLeft === null ? null : `${daysLeft} days`);
}

/** Rubric: under 600 ms to first byte 100 · under 1.5 s 60 · else 20. An error status is a fail. */
export function checkResponse(home: FetchResult): Finding<"response"> {
  const data = { status: home.status, responseMs: home.ttfbMs };
  if (home.status >= 400)
    return scored(0, `The home page returns an error (${home.status})`, data, String(home.status));
  const ms = home.ttfbMs;
  const score = ms < 600 ? 100 : ms < 1500 ? 60 : 20;
  const time = ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  return scored(score, score < 100 ? `Slow to respond: ${time}` : `Responding in ${time}`, data, time);
}
