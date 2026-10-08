import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

// Every request the checker sends to the site being checked goes through here. The
// address is checked when the connection opens, after DNS, so neither a redirect
// nor a name that resolves somewhere private can point the checker at its own
// network. Certificates aren't verified: a bad one is the HTTPS check's finding,
// not a reason to stop reading the site.

export const USER_AGENT = "Mozilla/5.0 (compatible; OkayplusSiteCheck/1.0; +https://okaypl.us/site-check)";

const PRIVATE = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(address, prefix, "ipv6");
}

/** False for loopback, private, link-local, reserved and documentation ranges. */
export function isPublicAddress(address: string) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPublicAddress(mapped);
  if (net.isIPv4(address)) return !PRIVATE.check(address, "ipv4");
  if (net.isIPv6(address)) return !PRIVATE.check(address, "ipv6");
  return false;
}

export class PrivateAddressError extends Error {
  code = "EPRIVATE";
}

/** `dns.lookup` that refuses private addresses, for `lookup` on sockets. Handles `all`, which Node asks for when it races IPv4 and IPv6. */
export const guardedLookup = ((
  hostname: string,
  options: dns.LookupOptions,
  callback: (error: Error | null, address: string | dns.LookupAddress[], family?: number) => void,
) => {
  dns.lookup(hostname, { ...options }, (error, address, family) => {
    if (error) return callback(error, address, family);
    const list = Array.isArray(address) ? address.map((a) => a.address) : [address];
    if (list.some((a) => !isPublicAddress(a))) {
      return callback(new PrivateAddressError(`${hostname} resolves to a private address`), address, family);
    }
    callback(null, address, family);
  });
}) as unknown as net.LookupFunction;

export type FetchResult = {
  /** Where it ended up, after redirects. */
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  /** Decoded as UTF-8, and cut off at `maxBytes`. Empty for HEAD. */
  body: string;
  /** Time to first byte of the final response. */
  ttfbMs: number;
  /** Every URL redirected through, in order. */
  redirects: string[];
};

type Options = {
  method?: "GET" | "HEAD";
  /** For each hop, from connecting to the end of the body. */
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
};

export class TimeoutError extends Error {
  code = "ETIMEDOUT";
}

function once(url: URL, { method = "GET", timeoutMs = 8000, maxBytes = 2_000_000, signal }: Options) {
  return new Promise<Omit<FetchResult, "url" | "redirects">>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const start = performance.now();
    const req = lib.request(
      url,
      {
        method,
        lookup: guardedLookup,
        rejectUnauthorized: false,
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en",
        },
      },
      (res) => {
        const ttfbMs = Math.round(performance.now() - start);
        const done = (body: string) => {
          clearTimeout(timer);
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, ttfbMs });
        };
        if (method === "HEAD" || (res.statusCode ?? 0) >= 300) {
          res.resume();
          return done("");
        }
        const encoding = res.headers["content-encoding"];
        const stream =
          encoding === "gzip"
            ? res.pipe(zlib.createGunzip())
            : encoding === "br"
              ? res.pipe(zlib.createBrotliDecompress())
              : encoding === "deflate"
                ? res.pipe(zlib.createInflate())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          if (size >= maxBytes) return;
          chunks.push(chunk);
          size += chunk.length;
          // Enough to read: stop downloading and keep what's here.
          if (size >= maxBytes) {
            done(Buffer.concat(chunks).subarray(0, maxBytes).toString("utf8"));
            req.destroy();
          }
        });
        stream.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
        stream.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      },
    );
    const timer = setTimeout(
      () => req.destroy(new TimeoutError(`${url.host} took over ${timeoutMs / 1000}s`)),
      timeoutMs,
    );
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.end();
  });
}

/** GET (or HEAD) a URL on the open web, following redirects. Throws on network errors, timeouts and private addresses. */
export async function safeFetch(input: string, options: Options = {}): Promise<FetchResult> {
  const { maxRedirects = 5 } = options;
  let url = new URL(input);
  const redirects: string[] = [];
  for (;;) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`Won't follow ${url.protocol} links`);
    const res = await once(url, options);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location && redirects.length < maxRedirects) {
      redirects.push(url.href);
      url = new URL(location, url);
      continue;
    }
    return { ...res, url: url.href, redirects };
  }
}

/** The error code behind a failed fetch: ENOTFOUND, ECONNREFUSED, ETIMEDOUT, EPRIVATE… */
export const errorCode = (error: unknown) =>
  (error as { code?: string })?.code ?? ((error as Error)?.name === "AbortError" ? "ABORTED" : "EUNKNOWN");

/** `safeFetch`, but null for anything other than a 200, including network errors. */
export async function fetchOk(input: string, options: Options = {}) {
  try {
    const res = await safeFetch(input, options);
    return res.status === 200 ? res : null;
  } catch {
    return null;
  }
}
