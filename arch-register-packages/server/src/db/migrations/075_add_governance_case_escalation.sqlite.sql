ALTER TABLE governance_case ADD COLUMN escalated_at TEXT;

ALTER TABLE workspace_governance_reminder_config ADD COLUMN escalation_enabled INTEGER NOT NULL DEFAULT 1;
