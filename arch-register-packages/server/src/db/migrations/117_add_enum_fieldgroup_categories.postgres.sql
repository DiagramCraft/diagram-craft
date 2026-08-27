ALTER TABLE workspace_enum ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE workspace_field_group ADD COLUMN IF NOT EXISTS category TEXT;
