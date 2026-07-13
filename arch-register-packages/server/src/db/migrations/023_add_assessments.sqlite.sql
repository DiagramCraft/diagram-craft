-- @creates assessment
CREATE TABLE IF NOT EXISTS assessment (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  scope       TEXT NOT NULL DEFAULT '[]',
  fields      TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS assessment_workspace_project_idx ON assessment(workspace, project_id);
