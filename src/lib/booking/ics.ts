// The calendar file sent with each booking email, and offered for download after
// booking. Its UID is the Google event's own, so a calendar that already has the
// event (a Gmail guest, say) updates it instead of adding a second, and SEQUENCE
// goes up with every change so the newest file wins.

export type IcsEvent = {
  uid: string;
  sequence: number;
  method: "REQUEST" | "CANCEL" | "PUBLISH";
  start: string;
  end: string;
  summary: string;
  description: string;
  location?: string | null;
  url?: string;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
};

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a content line at 75 octets, as RFC 5545 asks, without splitting a character. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join("\r\n ");
}

const name = (text: string) => `"${text.replace(/"/g, "'")}"`;

export function buildIcs(event: IcsEvent, now = new Date()) {
  const cancelled = event.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Okayplus//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(new Date(event.start).toISOString())}`,
    `DTEND:${stamp(new Date(event.end).toISOString())}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    `ORGANIZER;CN=${name(event.organizer.name)}:mailto:${event.organizer.email}`,
    `ATTENDEE;CN=${name(event.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${event.attendee.email}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
