import { after } from "next/server";
import { allow } from "@/lib/booking/limits";
import { bookingLog, reasonOf } from "@/lib/booking/log";
import { calendarFile } from "@/lib/booking/messages";
import { reschedule, sendRescheduledEmails, siteOrigin } from "@/lib/booking/service";
import { BOOKING } from "@/lib/booking/settings";
import { checkOrigin } from "@/lib/site-check/guard";
import { clientIp } from "@/lib/site-check/store";

// POST { manage, start } → moves the booking the manage link points at. The link
// is the guest's authority, so there's no bot check; the origin check and the
// per-visitor limit still apply.

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as { manage?: unknown; start?: unknown } | null;
  if (typeof body?.manage !== "string" || typeof body.start !== "string" || Number.isNaN(Date.parse(body.start))) {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const ip = clientIp(request);
  if (!(await allow("change", ip))) {
    bookingLog("rate-limited", { ip, reason: "reschedule" });
    return Response.json({ error: "rate-limited" }, { status: 429 });
  }
  try {
    const result = await reschedule(body.manage, body.start, siteOrigin(request));
    if (!result.ok) {
      const status = { "not-found": 404, cancelled: 410, past: 410, "slot-taken": 409, "calendar-failed": 502 }[
        result.error
      ];
      return Response.json({ error: result.error }, { status });
    }
    const { booking, previous, links } = result;
    after(() => sendRescheduledEmails(booking, previous, links));
    return Response.json({
      ok: true,
      booking: { start: booking.start, end: booking.end, meetLink: booking.meetLink, email: booking.guestEmail },
      ics: calendarFile(booking, BOOKING, "PUBLISH", links),
      links,
    });
  } catch (error) {
    bookingLog("error", { ip, reason: `reschedule failed: ${reasonOf(error)}` });
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
