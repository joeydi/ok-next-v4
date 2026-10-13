import { allow } from "@/lib/booking/limits";
import { bookingLog, reasonOf } from "@/lib/booking/log";
import { availableSlots, bookingForToken } from "@/lib/booking/service";
import { BOOKING, publicSettings } from "@/lib/booking/settings";
import { clientIp } from "@/lib/site-check/store";

// GET → the times a call can be booked at, as UTC ISO strings, and what the picker
// asks. With ?reschedule=<manage token>, the booking being moved too: its own
// time stays free for it, and the picker shows when it is now.

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (!(await allow("slots", ip))) {
    bookingLog("rate-limited", { ip, reason: "slots" });
    return Response.json({ error: "rate-limited" }, { status: 429 });
  }
  const token = new URL(request.url).searchParams.get("reschedule");
  try {
    const moving = token ? await bookingForToken(token) : null;
    if (token && (moving?.status !== "confirmed" || Date.parse(moving.start) < Date.now())) {
      return Response.json({ error: "not-found" }, { status: 404 });
    }
    const slots = await availableSlots(BOOKING, moving ?? undefined);
    return Response.json(
      {
        settings: publicSettings(BOOKING),
        slots,
        ...(moving && { booking: { start: moving.start, end: moving.end, name: moving.guestName } }),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    bookingLog("error", { ip, reason: `slots failed: ${reasonOf(error)}` });
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
