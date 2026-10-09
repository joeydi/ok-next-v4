-- A replayed run is shared by everyone who checks the same host within 15 minutes, so a run can
-- have several confirmed review requests. The first schema allowed one per run, and a later
-- visitor's email replaced an earlier one. Now the pair (run, email) is unique instead.
BEGIN;

CREATE TABLE review_requests_next (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES site_check_runs (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'in_progress', 'report_sent', 'closed')),
  private_notes TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (run_id, email)
);

INSERT INTO review_requests_next
  SELECT id, run_id, lower(email), confirmed_at, status, private_notes, completed_at, created_at, updated_at
  FROM review_requests;

DROP TABLE review_requests;
ALTER TABLE review_requests_next RENAME TO review_requests;

CREATE INDEX review_requests_status_updated_at_idx ON review_requests (status, updated_at DESC);
CREATE INDEX review_requests_confirmed_at_idx ON review_requests (confirmed_at);

COMMIT;
