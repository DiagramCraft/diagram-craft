-- @creates currency_rate_snapshot
-- @creates currency_rate_refresh_lock
CREATE TABLE IF NOT EXISTS currency_rate_snapshot (
  fetch_day      TEXT PRIMARY KEY,
  rate_date      TEXT NOT NULL,
  base_currency  TEXT NOT NULL,
  rates          TEXT NOT NULL,
  fetched_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS currency_rate_snapshot_fetched_idx
  ON currency_rate_snapshot(fetched_at);

CREATE TABLE IF NOT EXISTS currency_rate_refresh_lock (
  id            TEXT PRIMARY KEY,
  locked_until  TEXT NOT NULL
);

INSERT OR IGNORE INTO currency_rate_refresh_lock (id, locked_until)
VALUES ('global', '1970-01-01T00:00:00.000Z');
