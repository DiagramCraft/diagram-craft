-- @creates assessment
CREATE TABLE IF NOT EXISTS assessment (
  id          UUID PRIMARY KEY,
  workspace   UUID NOT NULL,
  project_id  UUID NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  scope       JSONB NOT NULL DEFAULT '[]',
  fields      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS assessment_workspace_project_idx ON assessment(workspace, project_id);
