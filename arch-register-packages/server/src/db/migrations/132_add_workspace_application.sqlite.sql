CREATE TABLE workspace_application (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  accent_color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workspace, key)
);

CREATE INDEX workspace_application_workspace_order_idx
  ON workspace_application (workspace, sort_order);

ALTER TABLE workspace_dashboard
  ADD COLUMN application_id TEXT REFERENCES workspace_application(id) ON DELETE CASCADE;
ALTER TABLE workspace_dashboard ADD COLUMN application_order INTEGER;
ALTER TABLE workspace_dashboard ADD COLUMN icon TEXT;
ALTER TABLE workspace_dashboard ADD COLUMN rail_label TEXT;

CREATE INDEX workspace_dashboard_application_idx
  ON workspace_dashboard (application_id, application_order);
