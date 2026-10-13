// Prints the refresh token the booking page signs in to Google Calendar with.
// Run once, on your own machine:
//
//   node --env-file-if-exists=.env.local scripts/google-auth.mjs
//
// It needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from an OAuth client of the
// "Desktop app" type (Google Cloud console → APIs & Services → Credentials, with
// the Google Calendar API enabled). It opens a consent page; sign in as the
// account whose calendar takes the bookings, allow access, and the token is
// printed here. Put it in GOOGLE_REFRESH_TOKEN in .env.local and on Vercel.

import { createServer } from "node:http";

const SCOPES = [
  // Create, move and delete the booking events.
  "https://www.googleapis.com/auth/calendar.events",
  // Read busy times across the chosen calendars.
  "https://www.googleapis.com/auth/calendar.freebusy",
  // List the calendars, for /admin/booking.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (in .env.local) first.");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", redirect);
  if (url.pathname !== "/") return res.writeHead(404).end();
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end(`Google said: ${url.searchParams.get("error") ?? "no code"}`);
    return finish(1);
  }
  const answer = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const json = await answer.json();
  if (!answer.ok || !json.refresh_token) {
    res.writeHead(500).end("That didn’t work; see the terminal.");
    console.error("Google answered:", json);
    return finish(1);
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Done. You can close this tab.");
  console.log(`\nGOOGLE_REFRESH_TOKEN=${json.refresh_token}\n`);
  console.log(`Granted: ${json.scope}`);
  finish(0);
});

function finish(code) {
  server.close();
  process.exitCode = code;
}

let redirect = "";
server.listen(0, "127.0.0.1", () => {
  redirect = `http://127.0.0.1:${server.address().port}`;
  const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  consent.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPES.join(" "),
    // A refresh token is only given with offline access, and only on a fresh consent.
    access_type: "offline",
    prompt: "consent",
  }).toString();
  console.log(`Open this link and allow access:\n\n${consent}\n`);
});
