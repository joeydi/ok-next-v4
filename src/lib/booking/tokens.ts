import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// The private link in every booking email, which lets the guest move or cancel
// their call: the booking's id and a signature over it, so any email (reminders
// included) can carry one without the database keeping it. Needs BOOKING_SECRET,
// a long random string; changing it breaks every link already sent.

function secret() {
  const value = process.env.BOOKING_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("BOOKING_SECRET isn’t set");
  return "development-only-booking-secret";
}

const sign = (id: string) => createHmac("sha256", secret()).update(`booking:${id}`).digest("base64url").slice(0, 32);

export const manageToken = (id: string) => `${id}.${sign(id)}`;

const TOKEN = /^(bk_[\w-]{8,40})\.([\w-]{32})$/;

/** The booking id a token was made for, or null if it wasn't made here. */
export function bookingIdFrom(token: string) {
  const match = TOKEN.exec(token);
  if (!match) return null;
  const expected = Buffer.from(sign(match[1]));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}
