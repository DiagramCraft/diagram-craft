ALTER TABLE governance_case
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

ALTER TABLE workspace_governance_reminder_config
  ADD COLUMN IF NOT EXISTS escalation_enabled BOOLEAN NOT NULL DEFAULT true;
