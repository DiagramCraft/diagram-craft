-- @creates workspace_dashboard
CREATE TABLE IF NOT EXISTS workspace_dashboard (
    id TEXT PRIMARY KEY,
    workspace TEXT NOT NULL UNIQUE REFERENCES workspace(id) ON DELETE CASCADE,
    layout TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_dashboard_workspace_idx
  ON workspace_dashboard(workspace);
