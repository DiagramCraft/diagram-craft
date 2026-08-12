ALTER TABLE entity_schema ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE entity_schema_version ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE relation_schema ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE relation_schema_version ADD COLUMN IF NOT EXISTS category TEXT;
