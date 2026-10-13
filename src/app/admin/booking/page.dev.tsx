import type { Metadata } from "next";
import { confirmedBetween } from "@/lib/booking/database";
import { type CalendarListItem, googleConfigured, listCalendars } from "@/lib/booking/google";
import { reasonOf } from "@/lib/booking/log";
import { AdminShell } from "../AdminShell";
import { readBookingSettings } from "./actions";
import { BookingAdmin } from "./BookingAdmin";

// Dev-only (see pageExtensions in next.config.ts): the booking page's calendars,
// hours, rules, blackout dates and questions, saved to src/data/booking.json,
// with a live preview of the times they'd offer and the calls coming up.

export const metadata: Metadata = { title: "Booking", robots: { index: false, follow: false } };

/** Calls booked in the next 90 days; none if the database can't be read. */
async function upcomingBookings() {
  const now = Date.now();
  return confirmedBetween(new Date(now).toISOString(), new Date(now + 90 * 24 * 60 * 60_000).toISOString()).catch(
    () => [],
  );
}

export default async function BookingAdminPage() {
  const settings = await readBookingSettings();
  let calendars: CalendarListItem[] | null = null;
  let calendarError: string | null = null;
  if (googleConfigured()) {
    try {
      calendars = await listCalendars();
    } catch (error) {
      calendarError = reasonOf(error);
    }
  }
  const upcoming = await upcomingBookings();

  return (
    <AdminShell>
      <BookingAdmin
        initial={settings}
        calendars={calendars}
        calendarError={calendarError}
        googleReady={googleConfigured()}
        upcoming={upcoming.map((b) => ({
          id: b.id,
          start: b.start,
          name: b.guestName,
          email: b.guestEmail,
          meetLink: b.meetLink,
        }))}
      />
    </AdminShell>
  );
}
