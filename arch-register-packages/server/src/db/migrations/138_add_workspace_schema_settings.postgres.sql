CREATE TABLE workspace_schema_settings (
  workspace UUID PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  schema_change_mode TEXT NOT NULL DEFAULT 'direct' CHECK (schema_change_mode IN ('direct', 'draft')),
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
