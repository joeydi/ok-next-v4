import "server-only";

import type { Busy } from "./slots";

// Google Calendar, over its REST API with plain fetch. It signs in as the owner
// with a long-lived refresh token (scripts/google-auth.mjs makes one) and trades
// it for an access token, kept until just before it expires. Events are created
// with sendUpdates=none, so Google sends no invitations of its own: the site's
// emails carry the .ics instead.

const API = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 8000;

/** Whether the Google variables are set. Without them, under `next dev`, the booking flow runs without a calendar. */
export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

let token: { value: string; until: number } | undefined;

async function accessToken() {
  if (token && token.until > Date.now()) return token.value;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN must be set");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google sign-in answered ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, until: Date.now() + (json.expires_in - 60) * 1000 };
  return token.value;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  // An event that's already gone is as good as deleted.
  if (method === "DELETE" && (res.status === 404 || res.status === 410)) return undefined as T;
  if (!res.ok)
    throw new Error(`Google Calendar ${method} ${path.split("?")[0]} answered ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type CalendarListItem = { id: string; summary: string; primary: boolean; color: string; accessRole: string };

/** The owner's calendars, for the admin page. */
export async function listCalendars(): Promise<CalendarListItem[]> {
  const json = await call<{
    items: {
      id: string;
      summary: string;
      summaryOverride?: string;
      primary?: boolean;
      backgroundColor?: string;
      accessRole: string;
    }[];
  }>("GET", "/users/me/calendarList?minAccessRole=freeBusyReader");
  return json.items.map((c) => ({
    id: c.id,
    summary: c.summaryOverride ?? c.summary,
    primary: Boolean(c.primary),
    color: c.backgroundColor ?? "",
    accessRole: c.accessRole,
  }));
}

/** Every busy stretch across `calendarIds`, merged. Throws if Google can't read one of them. */
export async function freeBusy(calendarIds: string[], timeMin: string, timeMax: string): Promise<Busy[]> {
  const json = await call<{ calendars: Record<string, { busy?: Busy[]; errors?: { reason: string }[] }> }>(
    "POST",
    "/freeBusy",
    { timeMin, timeMax, items: calendarIds.map((id) => ({ id })) },
  );
  return Object.entries(json.calendars).flatMap(([id, c]) => {
    if (c.errors?.length) throw new Error(`Google couldn’t read ${id}: ${c.errors.map((e) => e.reason).join(", ")}`);
    return c.busy ?? [];
  });
}

export type EventInput = {
  /** Our own id for the event, in base32hex (0-9, a-v), so its iCalUID is known before Google answers. */
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  attendee: { email: string; name: string };
};

type GoogleEvent = {
  id: string;
  iCalUID: string;
  hangoutLink?: string;
  htmlLink: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode: string } };
    entryPoints?: { entryPointType: string; uri: string }[];
  };
};

const meetLink = (event: GoogleEvent) =>
  event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;

const eventPath = (calendarId: string, id = "") =>
  `/calendars/${encodeURIComponent(calendarId)}/events${id && `/${encodeURIComponent(id)}`}`;

/** Creates the event with a Google Meet link. Returns its iCalUID and the Meet link, if Google made one in time. */
export async function insertEvent(calendarId: string, input: EventInput) {
  let event = await call<GoogleEvent>("POST", `${eventPath(calendarId)}?conferenceDataVersion=1&sendUpdates=none`, {
    id: input.id,
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start },
    end: { dateTime: input.end },
    attendees: [{ email: input.attendee.email, displayName: input.attendee.name }],
    conferenceData: { createRequest: { requestId: input.id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    reminders: { useDefault: true },
  });
  // Meet links are nearly always ready at once; when not, one more look usually finds it.
  for (let tries = 0; !meetLink(event) && tries < 3; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    event = await call<GoogleEvent>("GET", eventPath(calendarId, event.id));
  }
  return { iCalUID: event.iCalUID, meetLink: meetLink(event) };
}

/** Moves an event. */
export async function moveEvent(calendarId: string, id: string, start: string, end: string) {
  await call("PATCH", `${eventPath(calendarId, id)}?sendUpdates=none`, {
    start: { dateTime: start },
    end: { dateTime: end },
  });
}

export async function deleteEvent(calendarId: string, id: string) {
  await call("DELETE", `${eventPath(calendarId, id)}?sendUpdates=none`);
}
