import { track } from "@vercel/analytics";

// The booking flow's custom events for Vercel Web Analytics. Nothing personal goes
// in: no name, address or answers.

type Events = {
  "Booking opened": Record<string, never>;
  "Booking time picked": { reschedule: boolean };
  "Booking booked": Record<string, never>;
  "Booking rescheduled": Record<string, never>;
  "Booking failed": { error: string };
};

export function trackBooking<E extends keyof Events>(
  event: E,
  ...data: Events[E] extends Record<string, never> ? [] : [Events[E]]
) {
  track(event, data[0]);
}
