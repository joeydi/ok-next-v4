import { promises as dns } from "node:dns";
import { DISPOSABLE_DOMAINS } from "@/data/disposable-domains";
import { logEvent, reasonOf } from "./log";

// Checks an address before a confirmation goes to it: syntax and length, a
// throwaway-provider blocklist, then whether the domain can receive mail.

export type EmailProblem = "bad-email" | "disposable-email" | "no-mail-server";

const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const DNS_TIMEOUT_MS = 2500;

/** `{ email, domain }` lowercased and trimmed, or null if it isn't a plausible address. */
export function parseEmail(input: string) {
  const email = input.trim().toLowerCase();
  if (email.length > 254) return null;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (at < 1 || local.length > 64 || !LOCAL.test(local)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || domain.length > 253 || !labels.every((l) => LABEL.test(l))) return null;
  if (/^\d+$/.test(labels[labels.length - 1])) return null;
  return { email, domain };
}

const isDisposable = (domain: string) => {
  const labels = domain.split(".");
  // A subdomain of a listed provider counts too.
  return labels.some((_, i) => DISPOSABLE_DOMAINS.has(labels.slice(i).join(".")));
};

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS),
    ),
  ]);
}

/** Missing records (as opposed to a resolver that's down or slow). */
const absent = (error: unknown) => {
  const code = (error as { code?: string }).code;
  return code === "ENOTFOUND" || code === "ENODATA";
};

/** Whether `domain` takes mail: an MX record, else (RFC 5321) an A or AAAA. A slow or failing resolver passes; the confirmation link settles it. */
async function acceptsMail(domain: string) {
  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    // A single "." exchange is a null MX (RFC 7505): the domain says it takes no mail.
    return mx.some((r) => r.exchange && r.exchange !== ".");
  } catch (error) {
    if (!absent(error)) {
      logEvent("fail-open", { domain, reason: `MX lookup failed: ${reasonOf(error)}` });
      return true;
    }
  }
  for (const lookup of [dns.resolve4, dns.resolve6]) {
    try {
      if ((await withTimeout(lookup(domain))).length) return true;
    } catch (error) {
      if (!absent(error)) return true;
    }
  }
  return false;
}

export async function validateEmail(
  input: string,
): Promise<{ ok: true; email: string } | { ok: false; error: EmailProblem }> {
  const parsed = parseEmail(input);
  if (!parsed) return { ok: false, error: "bad-email" };
  if (isDisposable(parsed.domain)) return { ok: false, error: "disposable-email" };
  if (!(await acceptsMail(parsed.domain))) return { ok: false, error: "no-mail-server" };
  return { ok: true, email: parsed.email };
}
