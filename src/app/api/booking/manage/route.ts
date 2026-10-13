import { after } from "next/server";
import { SITE } from "@/data/site";
import { bookingLog, reasonOf } from "@/lib/booking/log";
import { formatWhen } from "@/lib/booking/messages";
import { bookingForToken, cancel, sendCancelledEmails, siteOrigin } from "@/lib/booking/service";
import { BOOKING } from "@/lib/booking/settings";
import { checkOrigin } from "@/lib/site-check/guard";
import { esc, standalonePage } from "@/lib/standalone-page";

// The private link in every booking email. GET shows the call with a way to move
// it and a button to cancel it; mail scanners open links, so only the button's
// POST cancels anything.

const page = (title: string, message: string, form?: string, status = 200) =>
  standalonePage({ title, message, form, status, back: { href: "/", label: `Back to ${SITE.name}` } });

const support = `<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>`;

const gone = () =>
  page(
    "That link doesn’t work",
    `It may be mistyped, or the call has already been cancelled. Write to ${support} if you need a hand.`,
    undefined,
    404,
  );

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const booking = await bookingForToken(token).catch((error) => {
    bookingLog("error", { reason: `manage link lookup failed: ${reasonOf(error)}` });
    return null;
  });
  if (!booking) return gone();
  const when = esc(formatWhen(booking.start, booking.end, booking.guestTimezone));
  if (booking.status === "cancelled") {
    return page(
      "This call is cancelled",
      `Your ${esc(BOOKING.title)} on ${when} is cancelled. <a href="/book">Book another time</a> whenever suits.`,
    );
  }
  if (Date.parse(booking.end) < Date.now()) {
    return page(
      "This call has happened",
      `Your ${esc(BOOKING.title)} was on ${when}. Write to ${support} to talk again.`,
    );
  }
  return page(
    `Your call on ${formatWhen(booking.start, booking.end, booking.guestTimezone).split(" · ")[0]}`,
    `${when}${booking.meetLink ? ` on <a href="${esc(booking.meetLink)}">Google Meet</a>` : ""}.</p><p>Need a different time? <a href="/book?reschedule=${esc(token)}">Pick another one</a>. Or cancel it here:`,
    `<form method="post" action="/api/booking/manage"><input type="hidden" name="token" value="${esc(token)}"><button type="submit">Cancel this call <span aria-hidden="true">→</span></button></form>`,
  );
}

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const token = String((await request.formData().catch(() => null))?.get("token") ?? "");
  const origin = siteOrigin(request);
  const result = await cancel(token, origin).catch((error) => {
    bookingLog("error", { reason: `cancel failed: ${reasonOf(error)}` });
    return { ok: false as const, error: "calendar-failed" as const };
  });
  if (!result.ok) {
    if (result.error === "not-found") return gone();
    if (result.error === "cancelled") {
      return page(
        "This call is cancelled",
        `It’s already off the calendar. <a href="/book">Book another time</a> whenever suits.`,
      );
    }
    if (result.error === "past")
      return page("This call has happened", `Write to ${support} to talk again.`, undefined, 410);
    return page(
      "That didn’t work",
      `Your call couldn’t be cancelled just now. Try again in a minute, or write to ${support}.`,
      undefined,
      502,
    );
  }
  const { booking, links } = result;
  after(() => sendCancelledEmails(booking, links, origin));
  return page(
    "Your call is cancelled",
    `It’s off my calendar, and an email is on its way with a file to take it off yours. <a href="/book">Book another time</a> whenever suits.`,
  );
}
