-- @creates workspace_assessment_type
CREATE TABLE IF NOT EXISTS workspace_assessment_type (
  id         TEXT PRIMARY KEY,
  workspace  TEXT NOT NULL,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS workspace_assessment_type_workspace_idx
  ON workspace_assessment_type(workspace, sort_order, id);

ALTER TABLE assessment ADD COLUMN assessment_type_id TEXT;
