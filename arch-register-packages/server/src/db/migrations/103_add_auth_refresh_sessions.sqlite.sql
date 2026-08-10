-- @creates auth_refresh_session
CREATE TABLE IF NOT EXISTS auth_refresh_session (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  issued_at   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  replaced_by TEXT,
  revoked_at  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_refresh_session_family_idx
  ON auth_refresh_session(family_id);

CREATE INDEX IF NOT EXISTS auth_refresh_session_user_idx
  ON auth_refresh_session(user_id);

CREATE INDEX IF NOT EXISTS auth_refresh_session_expiry_idx
  ON auth_refresh_session(expires_at);
