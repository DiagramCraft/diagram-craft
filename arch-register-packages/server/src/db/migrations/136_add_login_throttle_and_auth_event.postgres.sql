-- @creates login_throttle
CREATE TABLE IF NOT EXISTS login_throttle (
  key_type          TEXT NOT NULL CHECK (key_type IN ('account', 'ip')),
  key               TEXT NOT NULL,
  failure_count     INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key_type, key)
);

CREATE INDEX IF NOT EXISTS login_throttle_updated_idx ON login_throttle(updated_at);

-- @creates auth_event
CREATE TABLE IF NOT EXISTS auth_event (
  id          UUID PRIMARY KEY,
  event       TEXT NOT NULL CHECK (event IN (
    'login_success', 'login_failed', 'login_throttled', 'account_locked', 'account_unlocked'
  )),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS auth_event_created_idx ON auth_event(created_at);
CREATE INDEX IF NOT EXISTS auth_event_user_idx ON auth_event(user_id);
