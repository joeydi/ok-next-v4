import { after } from "next/server";
import { upcomingCount } from "@/lib/booking/database";
import { allow, BOOKING_LIMITS } from "@/lib/booking/limits";
import { bookingLog, reasonOf } from "@/lib/booking/log";
import { calendarFile } from "@/lib/booking/messages";
import { book, sendBookedEmails, siteOrigin } from "@/lib/booking/service";
import { ANSWER_MAX, BOOKING, isTimeZone } from "@/lib/booking/settings";
import { validateEmail } from "@/lib/site-check/email";
import { checkOrigin } from "@/lib/site-check/guard";
import { clientIp } from "@/lib/site-check/store";
import { checkBot } from "@/lib/site-check/turnstile";

// POST { start, name, email, site, timezone, answers, token, website } → books the call.
// `site` is the guest's website; `website` is the bot check's honeypot, which people
// never see. The bot check and origin check are the site check's. The answer carries the
// call's details and a calendar file for the confirmation step; the emails go
// out after the response.

type Body = {
  start?: unknown;
  name?: unknown;
  email?: unknown;
  site?: unknown;
  timezone?: unknown;
  answers?: unknown;
};

const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** The guest's website as a full https:// address, null when left blank, or false when it isn't one. */
function websiteOf(given: unknown): string | null | false {
  if (given === undefined || given === null) return null;
  if (typeof given !== "string") return false;
  const trimmed = given.trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.includes(".") ? url.href.replace(/\/$/, "") : false;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as Body | null;
  const botCheck = await checkBot(request, body);
  if (botCheck) return botCheck;
  if (!body) return bad("bad-request");

  const { start, name, email: given, site, timezone, answers } = body;
  if (typeof start !== "string" || Number.isNaN(Date.parse(start))) return bad("bad-start");
  if (typeof name !== "string" || !name.trim() || name.length > 120) return bad("bad-name");
  if (typeof given !== "string") return bad("bad-email");
  const website = websiteOf(site);
  if (website === false) return bad("bad-website");
  const zone = typeof timezone === "string" && isTimeZone(timezone) ? timezone : BOOKING.timezone;
  const givenAnswers = (answers && typeof answers === "object" ? answers : {}) as Record<string, unknown>;
  const checked: Record<string, string> = {};
  for (const q of BOOKING.questions) {
    const value = typeof givenAnswers[q.id] === "string" ? (givenAnswers[q.id] as string).trim() : "";
    if (value.length > ANSWER_MAX) return bad("bad-answer");
    if (q.required && !value) return bad("missing-answer");
    if (q.type === "select" && value && !q.options?.includes(value)) return bad("bad-answer");
    if (value) checked[q.id] = value;
  }

  const ip = clientIp(request);
  if (!(await allow("change", ip))) {
    bookingLog("rate-limited", { ip, reason: "book" });
    return bad("rate-limited", 429);
  }
  const valid = await validateEmail(given);
  if (!valid.ok) {
    bookingLog(valid.error, { ip });
    return bad(valid.error);
  }
  const { email } = valid;

  try {
    if ((await upcomingCount(email)) >= BOOKING_LIMITS.upcomingPerEmail) {
      bookingLog("email-limit", { ip, domain: email.split("@")[1] });
      return bad("email-limit", 429);
    }
    const origin = siteOrigin(request);
    const result = await book({ start, name: name.trim(), email, website, timezone: zone, answers: checked }, origin);
    if (!result.ok) {
      if (result.error === "slot-taken") bookingLog("slot-taken", { ip });
      return bad(result.error, result.error === "slot-taken" ? 409 : 502);
    }
    const { booking, links } = result;
    after(() => sendBookedEmails(booking, links));
    return Response.json({
      ok: true,
      booking: { start: booking.start, end: booking.end, meetLink: booking.meetLink, email: booking.guestEmail },
      ics: calendarFile(booking, BOOKING, "PUBLISH", links),
      links,
    });
  } catch (error) {
    bookingLog("error", { ip, reason: `booking failed: ${reasonOf(error)}` });
    return bad("failed", 500);
  }
}
