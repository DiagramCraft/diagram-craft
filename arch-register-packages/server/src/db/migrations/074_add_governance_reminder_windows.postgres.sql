ALTER TABLE governance_case
  ADD COLUMN IF NOT EXISTS reminder_windows_sent JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS workspace_governance_reminder_config (
  workspace         UUID        NOT NULL,
  case_kind         TEXT        NOT NULL,
  enabled           BOOLEAN     NOT NULL DEFAULT true,
  approaching_days  JSONB       NOT NULL DEFAULT '[]',
  overdue_days      JSONB       NOT NULL DEFAULT '[]',
  updated_at        TIMESTAMPTZ NOT NULL,
  updated_by        UUID,
  PRIMARY KEY (workspace, case_kind),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
