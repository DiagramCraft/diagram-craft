PRAGMA foreign_keys = OFF;

CREATE TABLE api_token_new (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  name            TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  capabilities    TEXT NOT NULL DEFAULT '[]',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at      TEXT NOT NULL,
  last_used_at    TEXT,
  expires_at      TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

INSERT INTO api_token_new (
  id, workspace, name, token_hash, capabilities, created_by, created_by_name,
  created_at, last_used_at, expires_at
)
SELECT t.id, t.workspace, t.name, t.token_hash, t.capabilities, t.created_by, u.display_name,
       t.created_at, t.last_used_at, t.expires_at
FROM api_token t
LEFT JOIN users u ON u.id = t.created_by;

DROP TABLE api_token;
ALTER TABLE api_token_new RENAME TO api_token;

CREATE INDEX IF NOT EXISTS api_token_workspace_idx ON api_token(workspace, created_at DESC);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (
  id, user_id, email, display_name, auth_provider, password_hash,
  is_active, is_system_actor, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-0000000000a3', 'system:removed-token-owner', NULL,
  'Removed user', 'local', NULL, 1, 1, datetime('now'), datetime('now')
);
