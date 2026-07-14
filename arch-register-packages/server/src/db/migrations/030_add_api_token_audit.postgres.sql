-- @creates api_token_audit
CREATE TABLE IF NOT EXISTS api_token_audit (
  id          UUID PRIMARY KEY,
  workspace   UUID NOT NULL,
  token_id    UUID NOT NULL,
  user_id     UUID,
  event       TEXT NOT NULL CHECK (event IN ('created', 'revoked', 'used')),
  created_at  TIMESTAMPTZ NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS api_token_audit_workspace_idx
  ON api_token_audit(workspace, created_at DESC);
CREATE INDEX IF NOT EXISTS api_token_audit_token_idx
  ON api_token_audit(token_id, created_at DESC);
