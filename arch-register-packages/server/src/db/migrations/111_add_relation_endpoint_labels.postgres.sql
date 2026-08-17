ALTER TABLE relation_schema ADD COLUMN IF NOT EXISTS in_label TEXT;
ALTER TABLE relation_schema ADD COLUMN IF NOT EXISTS out_label TEXT;
ALTER TABLE relation_schema_version ADD COLUMN IF NOT EXISTS in_label TEXT;
ALTER TABLE relation_schema_version ADD COLUMN IF NOT EXISTS out_label TEXT;
