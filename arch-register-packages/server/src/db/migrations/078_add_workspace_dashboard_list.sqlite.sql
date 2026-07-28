CREATE TABLE workspace_dashboard_new (
    id TEXT PRIMARY KEY,
    workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Overview',
    sort_order INTEGER NOT NULL DEFAULT 0,
    layout TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO workspace_dashboard_new (id, workspace, name, sort_order, layout, updated_at, updated_by)
  SELECT id, workspace, 'Overview', 0, layout, updated_at, updated_by
  FROM workspace_dashboard;

DROP TABLE workspace_dashboard;
ALTER TABLE workspace_dashboard_new RENAME TO workspace_dashboard;

CREATE INDEX IF NOT EXISTS workspace_dashboard_workspace_idx
  ON workspace_dashboard(workspace);
