CREATE TABLE IF NOT EXISTS workspace_enum (
  id         TEXT PRIMARY KEY,
  workspace  TEXT NOT NULL,
  name       TEXT NOT NULL,
  options    JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);
