-- @creates api_token
CREATE TABLE IF NOT EXISTS api_token (
  id            UUID PRIMARY KEY,
  workspace     UUID NOT NULL,
  name          TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  capabilities  JSONB NOT NULL DEFAULT '[]',
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS api_token_workspace_idx ON api_token(workspace, created_at DESC);
