-- Add OIDC authentication state storage table
CREATE TABLE IF NOT EXISTS oidc_auth_state (
  state         TEXT        PRIMARY KEY,
  nonce         TEXT        NOT NULL,
  code_verifier TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS oidc_auth_state_expires_at_idx ON oidc_auth_state(expires_at);
