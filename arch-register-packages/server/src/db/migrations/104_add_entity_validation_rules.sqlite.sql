ALTER TABLE entity_schema ADD COLUMN validation_rules TEXT NOT NULL DEFAULT '[]';

ALTER TABLE entity_schema_version ADD COLUMN validation_rules TEXT NOT NULL DEFAULT '[]';
