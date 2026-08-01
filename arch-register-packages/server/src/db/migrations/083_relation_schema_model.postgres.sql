-- Relation schema model (#2569): RelationSchema definitions, parallel to entity_schema, with
-- mandatory typed "in"/"out" endpoints each constrained to a set of allowed entity schema ids.

-- @creates relation_schema
CREATE TABLE relation_schema (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace                UUID NOT NULL,
  name                     TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  in_schema_ids            JSONB NOT NULL DEFAULT '[]',
  out_schema_ids           JSONB NOT NULL DEFAULT '[]',
  fields                   JSONB NOT NULL DEFAULT '[]',
  groups                   JSONB NOT NULL DEFAULT '[]',
  shared_field_group_links JSONB NOT NULL DEFAULT '[]',
  color                    TEXT,
  icon                     TEXT,
  relation_approval_policy TEXT NOT NULL DEFAULT 'disabled'
    CHECK (relation_approval_policy IN ('required', 'disabled')),
  version                  INTEGER NOT NULL DEFAULT 1,
  created_at               TIMESTAMPTZ NOT NULL,
  updated_at               TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT
);

-- @creates relation_schema_version
CREATE TABLE relation_schema_version (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace      UUID NOT NULL,
  schema_id      UUID NOT NULL,
  version        INTEGER NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  in_schema_ids  JSONB NOT NULL DEFAULT '[]',
  out_schema_ids JSONB NOT NULL DEFAULT '[]',
  fields         JSONB NOT NULL DEFAULT '[]',
  groups         JSONB NOT NULL DEFAULT '[]',
  color          TEXT,
  icon           TEXT,
  change_summary JSONB NOT NULL DEFAULT '{}',
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, schema_id, version),
  FOREIGN KEY (workspace, schema_id) REFERENCES relation_schema(workspace, id) ON DELETE CASCADE
);

CREATE INDEX relation_schema_version_workspace_schema_idx
  ON relation_schema_version(workspace, schema_id, version DESC);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('workspace', 'entity_schema', 'workspace_field_group', 'entity', 'project',
                          'content_node', 'assessment', 'assessment_response', 'project_milestone',
                          'relation_schema', 'relation'));
