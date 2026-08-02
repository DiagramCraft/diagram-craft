ALTER TABLE workspace_automation_rule
  ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;

