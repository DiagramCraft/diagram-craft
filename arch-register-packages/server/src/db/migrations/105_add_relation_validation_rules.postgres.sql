ALTER TABLE relation_schema ADD COLUMN validation_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE relation_schema_version ADD COLUMN validation_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
