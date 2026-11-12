-- @creates schema_publication
CREATE TABLE schema_publication (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  author TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT NOT NULL,
  migration_details TEXT NOT NULL DEFAULT '[]',
  items TEXT NOT NULL DEFAULT '[]',
  UNIQUE (workspace, number)
);

CREATE INDEX schema_publication_workspace_idx ON schema_publication(workspace, number DESC);
