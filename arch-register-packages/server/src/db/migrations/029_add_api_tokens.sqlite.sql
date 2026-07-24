-- @creates api_token
CREATE TABLE IF NOT EXISTS api_token (
  id            TEXT PRIMARY KEY,
  workspace     TEXT NOT NULL,
  name          TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  capabilities  TEXT NOT NULL DEFAULT '[]',
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_used_at  TEXT,
  expires_at    TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS api_token_workspace_idx ON api_token(workspace, created_at DESC);
