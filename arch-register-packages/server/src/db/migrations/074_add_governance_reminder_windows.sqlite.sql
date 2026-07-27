ALTER TABLE governance_case ADD COLUMN reminder_windows_sent TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS workspace_governance_reminder_config (
  workspace         TEXT NOT NULL,
  case_kind         TEXT NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  approaching_days  TEXT NOT NULL DEFAULT '[]',
  overdue_days      TEXT NOT NULL DEFAULT '[]',
  updated_at        TEXT NOT NULL,
  updated_by        TEXT,
  PRIMARY KEY (workspace, case_kind),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
