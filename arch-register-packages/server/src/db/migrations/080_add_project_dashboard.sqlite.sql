-- @creates project_dashboard
CREATE TABLE IF NOT EXISTS project_dashboard (
    id TEXT PRIMARY KEY,
    workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    layout TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS project_dashboard_workspace_project_idx
  ON project_dashboard(workspace, project_id);
