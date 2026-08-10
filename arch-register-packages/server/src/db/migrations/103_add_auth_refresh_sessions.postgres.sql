-- @creates auth_refresh_session
CREATE TABLE IF NOT EXISTS auth_refresh_session (
  id          UUID PRIMARY KEY,
  family_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  issued_at   TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  replaced_by UUID,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_refresh_session_family_idx
  ON auth_refresh_session(family_id);

CREATE INDEX IF NOT EXISTS auth_refresh_session_user_idx
  ON auth_refresh_session(user_id);

CREATE INDEX IF NOT EXISTS auth_refresh_session_expiry_idx
  ON auth_refresh_session(expires_at);
