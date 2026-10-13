-- The booking page's table. ok-next-admin owns the schema: copy this into its
-- migrations/ folder as the next numbered file and run `npm run migrate` there.
-- `npm test` and `next dev` without Turso apply it to a local file themselves.

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  -- The Google Calendar event's id, chosen by us (base32hex) and so known before Google answers.
  event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  ical_uid TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_timezone TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  meet_link TEXT,
  -- pending holds the slot while the calendar event is made; confirmed once it is.
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  -- The .ics SEQUENCE, bumped on every change so calendars take the newest.
  sequence INTEGER NOT NULL DEFAULT 0,
  reminder_day_at TEXT,
  reminder_hour_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT
);

-- One live booking per start time, so two people racing for a slot can't both get it.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_live_start ON bookings (start_at) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS bookings_status_start ON bookings (status, start_at);
CREATE INDEX IF NOT EXISTS bookings_guest_email ON bookings (guest_email, status);
