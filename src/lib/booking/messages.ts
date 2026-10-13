import "server-only";

import { SITE } from "@/data/site";
import { renderBookingEmail } from "@/emails/BookingEmail";
import type { Mail } from "@/lib/mail";
import type { Booking } from "./database";
import { buildIcs } from "./ics";
import type { BookingSettings } from "./settings";

// What each booking email says: to the guest when they book, move or cancel a
// call and before it starts, and to Joe when any of that happens. Guests' times
// are in their own timezone, Joe's in his.

/** Where booking emails come from and where Joe's go; the sender must be verified in SendGrid. */
const FROM = { email: process.env.BOOKING_FROM ?? SITE.email, name: SITE.author };
const OWNER = process.env.BOOKING_TO ?? SITE.email;

export type Links = { manage: string; reschedule: string };

/** "Tuesday, October 20 · 10:00 – 10:20am EDT" in `zone`. */
export function formatWhen(start: string, end: string, zone: string) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(start));
  const parts = (iso: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })
        .formatToParts(new Date(iso))
        .map((p) => [p.type, p.value]),
    );
  const from = parts(start);
  const to = parts(end);
  const meridiem = (p: Record<string, string>) => p.dayPeriod.toLowerCase();
  // "10:00 – 10:20am", or "11:50am – 12:10pm" across noon.
  const first = `${from.hour}:${from.minute}${from.dayPeriod === to.dayPeriod ? "" : meridiem(from)}`;
  return `${day} · ${first} – ${to.hour}:${to.minute}${meridiem(to)} ${to.timeZoneName}`;
}

const answerRows = (booking: Booking, settings: BookingSettings) =>
  settings.questions
    .filter((q) => booking.answers[q.id])
    .map((q) => ({ label: q.label, value: booking.answers[q.id] }));

/** What the calendar event says, on Joe's calendar and the guest's. */
export function eventDescription(
  booking: Pick<Booking, "answers" | "guestName" | "guestEmail">,
  settings: BookingSettings,
) {
  return [
    `${booking.guestName} <${booking.guestEmail}>`,
    ...settings.questions.filter((q) => booking.answers[q.id]).flatMap((q) => ["", q.label, booking.answers[q.id]]),
    "",
    `Booked through ${SITE.url.replace("https://", "")}`,
  ].join("\n");
}

export const eventSummary = (guestName: string, settings: BookingSettings) =>
  `${settings.title}: ${guestName} + ${SITE.author}`;

/** The booking as a calendar file. REQUEST and CANCEL go with emails; PUBLISH is the download after booking. */
export function calendarFile(
  booking: Booking,
  settings: BookingSettings,
  method: "REQUEST" | "CANCEL" | "PUBLISH",
  links: Links,
) {
  return buildIcs({
    uid: booking.icalUid ?? `${booking.eventId}@google.com`,
    sequence: booking.sequence,
    method,
    start: booking.start,
    end: booking.end,
    summary: eventSummary(booking.guestName, settings),
    description: [
      booking.meetLink && `Join with Google Meet: ${booking.meetLink}`,
      `Reschedule or cancel: ${links.manage}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    location: booking.meetLink,
    organizer: { name: SITE.author, email: FROM.email },
    attendee: { name: booking.guestName, email: booking.guestEmail },
  });
}

function ics(booking: Booking, settings: BookingSettings, method: "REQUEST" | "CANCEL", links: Links) {
  return {
    content: Buffer.from(calendarFile(booking, settings, method, links)).toString("base64"),
    filename: method === "CANCEL" ? "cancel.ics" : "invite.ics",
    type: `text/calendar; charset=utf-8; method=${method}`,
  };
}

async function mail(
  to: string,
  replyTo: string | undefined,
  props: Parameters<typeof renderBookingEmail>[0],
  attachments?: Mail["attachments"],
): Promise<Mail> {
  const text = [
    ...props.paragraphs,
    "",
    ...props.details.map((d) =>
      d.href && d.href !== d.value && !d.href.startsWith("mailto:")
        ? `${d.label}: ${d.value} (${d.href})`
        : `${d.label}: ${d.value}`,
    ),
    ...(props.action ? ["", `${props.action.label}: ${props.action.href}`] : []),
    ...(props.links ?? []).map((l) => `${l.label}: ${l.href}`),
    ...(props.note ? ["", props.note] : []),
    "",
    `${SITE.author}, ${SITE.name}`,
  ].join("\n");
  return {
    to,
    from: FROM,
    replyTo,
    subject: props.title,
    text,
    html: await renderBookingEmail(props),
    attachments,
  };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0];

const guestDetails = (booking: Booking) => [
  { label: "When", value: formatWhen(booking.start, booking.end, booking.guestTimezone) },
  booking.meetLink
    ? { label: "Where", value: "Google Meet", href: booking.meetLink }
    : { label: "Where", value: "A video link will follow by email" },
];

const joinAction = (booking: Booking) =>
  booking.meetLink ? { action: { label: "Join the call", href: booking.meetLink } } : {};

const guestLinks = (links: Links) => [
  { label: "Reschedule", href: links.reschedule },
  { label: "Cancel", href: links.manage },
];

export function guestConfirmed(booking: Booking, settings: BookingSettings, links: Links) {
  return mail(
    booking.guestEmail,
    OWNER,
    {
      title: "You’re booked in",
      preview: formatWhen(booking.start, booking.end, booking.guestTimezone),
      paragraphs: [
        `Thanks, ${firstName(booking.guestName)}. Your ${settings.title} is on my calendar, and the invite attached here will add it to yours.`,
        "If anything comes up before then, reply to this email.",
      ],
      details: guestDetails(booking),
      ...joinAction(booking),
      links: guestLinks(links),
    },
    [ics(booking, settings, "REQUEST", links)],
  );
}

export function guestRescheduled(booking: Booking, settings: BookingSettings, links: Links) {
  return mail(
    booking.guestEmail,
    OWNER,
    {
      title: "Your call has moved",
      preview: formatWhen(booking.start, booking.end, booking.guestTimezone),
      paragraphs: [`Your ${settings.title} is now at the time below. The attached invite updates your calendar.`],
      details: guestDetails(booking),
      ...joinAction(booking),
      links: guestLinks(links),
    },
    [ics(booking, settings, "REQUEST", links)],
  );
}

export function guestCancelled(booking: Booking, settings: BookingSettings, links: Links, bookAgain: string) {
  return mail(
    booking.guestEmail,
    OWNER,
    {
      title: "Your call is cancelled",
      preview: formatWhen(booking.start, booking.end, booking.guestTimezone),
      paragraphs: [
        `Your ${settings.title} below is cancelled, and the attached file takes it off your calendar.`,
        "If you’d like to find another time, you can book again whenever suits.",
      ],
      details: [{ label: "Was", value: formatWhen(booking.start, booking.end, booking.guestTimezone) }],
      action: { label: "Book another time", href: bookAgain },
    },
    [ics(booking, settings, "CANCEL", links)],
  );
}

export function guestReminder(booking: Booking, settings: BookingSettings, links: Links, which: "day" | "hour") {
  return mail(booking.guestEmail, OWNER, {
    title: which === "day" ? "Talk tomorrow" : "Talk soon",
    preview: formatWhen(booking.start, booking.end, booking.guestTimezone),
    paragraphs: [
      which === "day"
        ? `A reminder that our ${settings.title} is coming up tomorrow.`
        : `A reminder that our ${settings.title} starts in about an hour.`,
    ],
    details: guestDetails(booking),
    ...joinAction(booking),
    links: guestLinks(links),
  });
}

export function ownerBooked(booking: Booking, settings: BookingSettings) {
  return mail(OWNER, booking.guestEmail, {
    title: `New booking: ${booking.guestName}`,
    preview: formatWhen(booking.start, booking.end, settings.timezone),
    paragraphs: [`${booking.guestName} booked a ${settings.title}. Reply to write to them.`],
    details: [
      { label: "When", value: formatWhen(booking.start, booking.end, settings.timezone) },
      { label: "Who", value: `${booking.guestName} <${booking.guestEmail}>`, href: `mailto:${booking.guestEmail}` },
      { label: "Their time", value: formatWhen(booking.start, booking.end, booking.guestTimezone) },
      ...(booking.meetLink ? [{ label: "Meet", value: booking.meetLink, href: booking.meetLink }] : []),
      ...answerRows(booking, settings),
    ],
  });
}

export function ownerRescheduled(
  booking: Booking,
  settings: BookingSettings,
  previousStart: string,
  previousEnd: string,
) {
  return mail(OWNER, booking.guestEmail, {
    title: `Moved: ${booking.guestName}`,
    preview: formatWhen(booking.start, booking.end, settings.timezone),
    paragraphs: [`${booking.guestName} moved their ${settings.title}.`],
    details: [
      { label: "Now", value: formatWhen(booking.start, booking.end, settings.timezone) },
      { label: "Was", value: formatWhen(previousStart, previousEnd, settings.timezone) },
      { label: "Who", value: `${booking.guestName} <${booking.guestEmail}>`, href: `mailto:${booking.guestEmail}` },
    ],
  });
}

export function ownerCancelled(booking: Booking, settings: BookingSettings) {
  return mail(OWNER, booking.guestEmail, {
    title: `Cancelled: ${booking.guestName}`,
    preview: formatWhen(booking.start, booking.end, settings.timezone),
    paragraphs: [`${booking.guestName} cancelled their ${settings.title}. It’s off your calendar.`],
    details: [
      { label: "Was", value: formatWhen(booking.start, booking.end, settings.timezone) },
      { label: "Who", value: `${booking.guestName} <${booking.guestEmail}>`, href: `mailto:${booking.guestEmail}` },
    ],
  });
}
