CREATE TABLE IF NOT EXISTS workspace_enum (
  id         TEXT PRIMARY KEY,
  workspace  TEXT NOT NULL,
  name       TEXT NOT NULL,
  options    TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);
