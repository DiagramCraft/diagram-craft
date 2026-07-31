-- @creates workspace_field_group
CREATE TABLE IF NOT EXISTS workspace_field_group (
  id         UUID PRIMARY KEY,
  workspace  UUID NOT NULL,
  name       TEXT NOT NULL,
  description TEXT,
  fields     JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

ALTER TABLE entity_schema ADD COLUMN IF NOT EXISTS shared_field_group_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE entity_schema_version ADD COLUMN IF NOT EXISTS shared_field_group_ids JSONB NOT NULL DEFAULT '[]';

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('workspace', 'entity_schema', 'workspace_field_group', 'entity', 'project', 'content_node', 'assessment', 'assessment_response', 'project_milestone'));
