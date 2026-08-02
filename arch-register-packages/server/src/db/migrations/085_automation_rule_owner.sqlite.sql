ALTER TABLE workspace_automation_rule
  ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;

