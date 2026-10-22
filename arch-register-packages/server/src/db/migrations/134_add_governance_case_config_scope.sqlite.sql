-- @creates workspace_governance_case_scope
CREATE TABLE workspace_governance_case_scope (
  config_id    TEXT NOT NULL,
  workspace    TEXT NOT NULL,
  case_kind    TEXT NOT NULL,
  case_subkind TEXT NOT NULL,
  PRIMARY KEY (config_id, case_subkind),
  FOREIGN KEY (config_id) REFERENCES workspace_governance_case_config(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

-- At most one workflow may cover a given (case_kind, subkind) within a workspace.
CREATE UNIQUE INDEX workspace_governance_case_scope_unique
  ON workspace_governance_case_scope (workspace, case_kind, case_subkind);

INSERT INTO workspace_governance_case_scope (config_id, workspace, case_kind, case_subkind)
SELECT id, workspace, case_kind, case_subkind
FROM workspace_governance_case_config
WHERE case_subkind IS NOT NULL;

ALTER TABLE workspace_governance_case_config ADD COLUMN workspace_wide INTEGER NOT NULL DEFAULT 0;
UPDATE workspace_governance_case_config SET workspace_wide = 1 WHERE case_subkind IS NULL;

DROP INDEX workspace_governance_case_config_unique;
ALTER TABLE workspace_governance_case_config DROP COLUMN case_subkind;

-- At most one workspace-wide (fallback) workflow per case kind.
CREATE UNIQUE INDEX workspace_governance_case_config_wide_unique
  ON workspace_governance_case_config (workspace, case_kind)
  WHERE workspace_wide = 1;
