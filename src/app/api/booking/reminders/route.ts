import { deleteOldBookings } from "@/lib/booking/database";
import { bookingLog, reasonOf } from "@/lib/booking/log";
import { sendDueReminders, siteOrigin } from "@/lib/booking/service";

// Run by Vercel Cron (vercel.json) to email reminders a day and an hour before
// each call, and to delete bookings past their retention (see /privacy). Vercel sends CRON_SECRET as a bearer token; anything else is refused.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendDueReminders(siteOrigin());
    const deleted = await deleteOldBookings();
    bookingLog("reminders", { sent: result.sent });
    return Response.json({ ...result, deleted });
  } catch (error) {
    bookingLog("error", { reason: `reminders failed: ${reasonOf(error)}` });
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
