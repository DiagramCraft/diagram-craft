ALTER TABLE entity_schema ADD COLUMN deprecation_policy TEXT NOT NULL DEFAULT 'disabled'
  CHECK (deprecation_policy IN ('required', 'disabled'));
