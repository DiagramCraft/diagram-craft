-- @creates currency_rate_snapshot
-- @creates currency_rate_refresh_lock
CREATE TABLE IF NOT EXISTS currency_rate_snapshot (
  fetch_day      DATE PRIMARY KEY,
  rate_date      DATE NOT NULL,
  base_currency  TEXT NOT NULL,
  rates          JSONB NOT NULL,
  fetched_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS currency_rate_snapshot_fetched_idx
  ON currency_rate_snapshot(fetched_at);

CREATE TABLE IF NOT EXISTS currency_rate_refresh_lock (
  id            TEXT PRIMARY KEY,
  locked_until  TIMESTAMPTZ NOT NULL
);

INSERT INTO currency_rate_refresh_lock (id, locked_until)
VALUES ('global', TIMESTAMPTZ '1970-01-01 00:00:00+00')
ON CONFLICT (id) DO NOTHING;
