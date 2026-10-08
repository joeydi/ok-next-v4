import type { IncomingHttpHeaders } from "node:http";
import { type Finding, scored } from "./score";

/** The security headers looked for, with their weight in the score. CSP is weighted lightly: few WordPress sites can run one. */
const HEADERS = [
  { name: "strict-transport-security", label: "HSTS", weight: 30 },
  { name: "x-content-type-options", label: "X-Content-Type-Options", weight: 20 },
  { name: "x-frame-options", label: "X-Frame-Options", weight: 20 },
  { name: "referrer-policy", label: "Referrer-Policy", weight: 15 },
  { name: "content-security-policy", label: "Content-Security-Policy", weight: 15 },
] as const;

/** Rubric: the weighted share of the five headers that are set. */
export function checkHeaders(headers: IncomingHttpHeaders): Finding<"headers"> {
  const csp = String(headers["content-security-policy"] ?? "");
  // A CSP's frame-ancestors does X-Frame-Options' job.
  const has = (name: string) => !!headers[name] || (name === "x-frame-options" && csp.includes("frame-ancestors"));
  const present = HEADERS.filter((h) => has(h.name));
  const missing = HEADERS.filter((h) => !has(h.name));
  const score = present.reduce((sum, h) => sum + h.weight, 0);
  const data = { present: present.map((h) => h.name), missing: missing.map((h) => h.name) };
  // Worst first: the summary names the heaviest missing headers.
  const named = [...missing].sort((a, b) => b.weight - a.weight).map((h) => h.label);
  const summary = !missing.length
    ? "All five security headers are set"
    : !present.length
      ? "None of the five security headers are set"
      : missing.length <= 2
        ? `No ${named.join(" or ")} header`
        : `${missing.length} of 5 security headers missing, including ${named[0]}`;
  return scored(score, summary, data, missing.length ? `${missing.length} missing` : null);
}
