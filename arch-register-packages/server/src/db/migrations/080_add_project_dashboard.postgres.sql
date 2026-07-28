-- @creates project_dashboard
CREATE TABLE IF NOT EXISTS project_dashboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    layout JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS project_dashboard_workspace_project_idx
  ON project_dashboard(workspace, project_id);
