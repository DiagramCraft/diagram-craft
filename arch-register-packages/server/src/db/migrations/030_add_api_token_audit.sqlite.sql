-- @creates api_token_audit
CREATE TABLE IF NOT EXISTS api_token_audit (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  token_id    TEXT NOT NULL,
  user_id     TEXT,
  event       TEXT NOT NULL CHECK (event IN ('created', 'revoked', 'used')),
  created_at  TEXT NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS api_token_audit_workspace_idx
  ON api_token_audit(workspace, created_at DESC);
CREATE INDEX IF NOT EXISTS api_token_audit_token_idx
  ON api_token_audit(token_id, created_at DESC);
