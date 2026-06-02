-- Add OIDC authentication state storage table
-- @creates oidc_auth_state
CREATE TABLE oidc_auth_state (
  state         TEXT PRIMARY KEY,
  nonce         TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);

CREATE INDEX oidc_auth_state_expires_at_idx ON oidc_auth_state(expires_at);
