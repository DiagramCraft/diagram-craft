-- @creates workspace_automation_rule
CREATE TABLE workspace_automation_rule (
  id          UUID PRIMARY KEY,
  workspace   UUID NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  schema_id   UUID,
  trigger     JSONB NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX workspace_automation_rule_workspace_idx
  ON workspace_automation_rule(workspace, enabled);
