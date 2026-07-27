-- @creates workspace_dashboard
CREATE TABLE IF NOT EXISTS workspace_dashboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace UUID NOT NULL UNIQUE REFERENCES workspace(id) ON DELETE CASCADE,
    layout JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_dashboard_workspace_idx
  ON workspace_dashboard(workspace);
