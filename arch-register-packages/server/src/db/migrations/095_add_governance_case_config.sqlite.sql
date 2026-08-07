DROP TABLE IF EXISTS workspace_governance_reminder_config;

-- @creates workspace_governance_case_config
CREATE TABLE workspace_governance_case_config (
  id           TEXT NOT NULL PRIMARY KEY,
  workspace    TEXT NOT NULL,
  case_kind    TEXT NOT NULL,
  case_subkind TEXT,
  enabled      INTEGER NOT NULL DEFAULT 1,
  config       TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL,
  updated_by   TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX workspace_governance_case_config_unique
  ON workspace_governance_case_config (workspace, case_kind, COALESCE(case_subkind, ''));
