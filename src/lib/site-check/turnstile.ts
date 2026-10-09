// Server side of the bot check on the run and review endpoints: a hidden form field
// no visitor fills in, and a Cloudflare Turnstile token the page fetched before it
// posted. Turnstile is skipped when its keys aren't set (local development), the
// honeypot never is. If Cloudflare itself can't be reached the check lets the
// request through, like the store does when Redis is down.

const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** What the page sends beside its own fields: the Turnstile token and the honeypot's value. */
type BotFields = { token?: unknown; website?: unknown };

function refuse(why: string) {
  console.warn(`[site check] bot-check: ${why}`);
  return Response.json({ error: "bot-check" }, { status: 403 });
}

/** A 403 `{ error: "bot-check" }` if the request looks automated, otherwise null. */
export async function checkBot(request: Request, parsed: object | null) {
  const body = parsed as BotFields | null;
  if (typeof body?.website === "string" && body.website !== "") return refuse("honeypot filled");

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;
  const token = body?.token;
  if (typeof token !== "string" || token === "" || token.length > 2048) return refuse("no token");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  try {
    const res = await fetch(VERIFY, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, ...(ip && { remoteip: ip }) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`siteverify answered ${res.status}`);
    const result = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return result.success ? null : refuse(`token rejected (${result["error-codes"]?.join(", ") ?? "no reason"})`);
  } catch (error) {
    console.error("[site check] fail-open: Turnstile couldn’t verify a token", error);
    return null;
  }
}
