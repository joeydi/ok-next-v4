import { getDomain } from "tldts";
import { daysUntil, type Finding, scored, skipped } from "./score";

// The registration's expiry, from RDAP: IANA's bootstrap file says which registry
// answers for each TLD. Some country-code registries don't run RDAP; for those the
// check is skipped rather than guessed.

type Bootstrap = { services: [string[], string[]][] };

let servers: Promise<Map<string, string>> | null = null;

function rdapServers() {
  servers ??= fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json() as Promise<Bootstrap>)
    .then(({ services }) => {
      const map = new Map<string, string>();
      for (const [tlds, urls] of services) for (const tld of tlds) map.set(tld, urls[0]);
      return map;
    })
    .catch((error) => {
      servers = null; // try again next run
      throw error;
    });
  return servers;
}

type Rdap = {
  events?: { eventAction: string; eventDate: string }[];
  entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[];
};

/** Rubric: expired or under 2 weeks left 0 · under 60 days 60 · else 100. */
export async function checkDomain(host: string): Promise<Finding<"domain">> {
  const domain = getDomain(host) ?? host;
  const base = (await rdapServers()).get(domain.split(".").pop() ?? "");
  if (!base) return skipped("This domain’s registry doesn’t publish expiry dates");
  const res = await fetch(`${base.replace(/\/?$/, "/")}domain/${domain}`, {
    headers: { accept: "application/rdap+json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return skipped("The registry didn’t return the registration");
  const rdap = (await res.json()) as Rdap;
  const expiresAt = rdap.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null;
  const registrar =
    rdap.entities?.find((e) => e.roles?.includes("registrar"))?.vcardArray?.[1].find(([key]) => key === "fn")?.[3] ??
    null;
  if (!expiresAt) return skipped("The registry doesn’t share this domain’s expiry date", null);
  const daysLeft = daysUntil(expiresAt);
  const data = { domain, registrar, expiresAt, daysLeft };
  const when = new Date(expiresAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  if (daysLeft < 0) return scored(0, `${domain} expired in ${when}`, data, "expired");
  if (daysLeft < 14) return scored(0, `${domain} expires in ${daysLeft} days`, data, `${daysLeft} days`);
  if (daysLeft < 60) return scored(60, `${domain} expires in ${daysLeft} days`, data, `${daysLeft} days`);
  return scored(100, `Registered through ${when}`, data, new Date(expiresAt).getUTCFullYear().toString());
}
