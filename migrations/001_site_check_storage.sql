PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_check_runs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration >= 0),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  verdict TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  checker_version TEXT NOT NULL,
  results_json TEXT NOT NULL CHECK (json_valid(results_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS site_check_runs_checked_at_idx ON site_check_runs (checked_at);
CREATE INDEX IF NOT EXISTS site_check_runs_host_checked_at_idx ON site_check_runs (host, checked_at DESC);

CREATE TABLE IF NOT EXISTS review_requests (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES site_check_runs (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'in_progress', 'report_sent', 'closed')),
  private_notes TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS review_requests_status_updated_at_idx
  ON review_requests (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS review_requests_confirmed_at_idx ON review_requests (confirmed_at);
