DROP TABLE IF EXISTS workspace_governance_reminder_config;

-- @creates workspace_governance_case_config
CREATE TABLE workspace_governance_case_config (
  id           UUID        PRIMARY KEY,
  workspace    UUID        NOT NULL,
  case_kind    TEXT        NOT NULL,
  case_subkind TEXT,
  name         TEXT        NOT NULL,
  description  TEXT,
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  config       JSONB       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL,
  updated_by   UUID,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX workspace_governance_case_config_unique
  ON workspace_governance_case_config (workspace, case_kind, COALESCE(case_subkind, ''));
