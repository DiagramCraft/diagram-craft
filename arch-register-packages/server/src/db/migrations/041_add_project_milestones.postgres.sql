-- @creates project_milestone
CREATE TABLE IF NOT EXISTS project_milestone (
  id          UUID PRIMARY KEY,
  workspace   UUID NOT NULL,
  project_id  UUID NOT NULL,
  name        TEXT NOT NULL,
  target_date DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'complete', 'cancelled')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS project_milestone_workspace_project_idx ON project_milestone(workspace, project_id);
