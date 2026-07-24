-- @creates job_server
CREATE TABLE IF NOT EXISTS job_server (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  instance_id   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('available', 'unavailable')),
  last_seen_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS job_server_last_seen_idx
  ON job_server(last_seen_at DESC);
