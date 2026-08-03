ALTER TABLE workspace_automation_rule
  ADD COLUMN resource_type TEXT NOT NULL DEFAULT 'entity'
  CHECK (resource_type IN ('entity', 'relation'));
