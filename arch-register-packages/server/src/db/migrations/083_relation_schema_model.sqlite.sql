-- Relation schema model (#2569): RelationSchema definitions, parallel to entity_schema, with
-- mandatory typed "in"/"out" endpoints each constrained to a set of allowed entity schema ids.

-- @creates relation_schema
CREATE TABLE relation_schema (
  id                       TEXT PRIMARY KEY,
  workspace                TEXT NOT NULL,
  name                     TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  in_schema_ids            TEXT NOT NULL DEFAULT '[]',
  out_schema_ids           TEXT NOT NULL DEFAULT '[]',
  fields                   TEXT NOT NULL DEFAULT '[]',
  groups                   TEXT NOT NULL DEFAULT '[]',
  shared_field_group_links TEXT NOT NULL DEFAULT '[]',
  color                    TEXT,
  icon                     TEXT,
  relation_approval_policy TEXT NOT NULL DEFAULT 'disabled'
    CHECK (relation_approval_policy IN ('required', 'disabled')),
  version                  INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT
);

-- @creates relation_schema_version
CREATE TABLE relation_schema_version (
  id             TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL,
  schema_id      TEXT NOT NULL,
  version        INTEGER NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  in_schema_ids  TEXT NOT NULL DEFAULT '[]',
  out_schema_ids TEXT NOT NULL DEFAULT '[]',
  fields         TEXT NOT NULL DEFAULT '[]',
  groups         TEXT NOT NULL DEFAULT '[]',
  color          TEXT,
  icon           TEXT,
  change_summary TEXT NOT NULL DEFAULT '{}',
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (workspace, schema_id, version),
  FOREIGN KEY (workspace, schema_id) REFERENCES relation_schema(workspace, id) ON DELETE CASCADE
);

CREATE INDEX relation_schema_version_workspace_schema_idx
  ON relation_schema_version(workspace, schema_id, version DESC);

PRAGMA foreign_keys = OFF;

CREATE TABLE audit_log_new (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  user_id         TEXT,
  operation       TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('workspace', 'entity_schema', 'workspace_field_group', 'entity', 'project', 'content_node', 'assessment', 'assessment_response', 'project_milestone', 'relation_schema', 'relation')),
  entity_id       TEXT NOT NULL,
  entity_name     TEXT NOT NULL,
  entity_slug     TEXT,
  schema_id       TEXT,
  changes         TEXT NOT NULL DEFAULT '{}',
  metadata        TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO audit_log_new (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata)
  SELECT id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata
  FROM audit_log;
DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;
CREATE INDEX audit_log_workspace_timestamp_idx ON audit_log(workspace, timestamp DESC);

PRAGMA foreign_keys = ON;
