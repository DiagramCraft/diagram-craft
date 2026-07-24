-- @creates workspace_automation_rule
CREATE TABLE workspace_automation_rule (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  schema_id   TEXT,
  trigger     TEXT NOT NULL,
  conditions  TEXT NOT NULL DEFAULT '[]',
  actions     TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX workspace_automation_rule_workspace_idx
  ON workspace_automation_rule(workspace, enabled);
