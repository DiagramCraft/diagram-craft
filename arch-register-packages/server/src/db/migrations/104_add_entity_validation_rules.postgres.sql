ALTER TABLE entity_schema ADD COLUMN IF NOT EXISTS validation_rules JSONB NOT NULL DEFAULT '[]';

ALTER TABLE entity_schema_version ADD COLUMN IF NOT EXISTS validation_rules JSONB NOT NULL DEFAULT '[]';
