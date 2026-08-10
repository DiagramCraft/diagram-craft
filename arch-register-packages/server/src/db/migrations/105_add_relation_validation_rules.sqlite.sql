ALTER TABLE relation_schema ADD COLUMN validation_rules TEXT NOT NULL DEFAULT '[]';
ALTER TABLE relation_schema_version ADD COLUMN validation_rules TEXT NOT NULL DEFAULT '[]';
