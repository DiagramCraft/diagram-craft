ALTER TABLE workspace_dashboard ADD COLUMN IF NOT EXISTS app_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_dashboard_app_key_idx
  ON workspace_dashboard(workspace, app_key)
  WHERE app_key IS NOT NULL;
