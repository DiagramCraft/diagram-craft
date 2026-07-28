ALTER TABLE workspace_dashboard DROP CONSTRAINT IF EXISTS workspace_dashboard_workspace_key;
DROP INDEX IF EXISTS workspace_dashboard_workspace_idx;

ALTER TABLE workspace_dashboard ADD COLUMN name TEXT NOT NULL DEFAULT 'Overview';
ALTER TABLE workspace_dashboard ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS workspace_dashboard_workspace_idx
  ON workspace_dashboard(workspace);
