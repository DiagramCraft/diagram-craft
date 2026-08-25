PRAGMA foreign_keys = OFF;

CREATE TABLE audit_log_new (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  user_id         TEXT,
  operation       TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('workspace', 'workspace_enum', 'entity_schema', 'workspace_field_group', 'entity', 'project', 'content_node', 'assessment', 'assessment_response', 'project_milestone', 'relation_schema', 'relation', 'automation_note')),
  entity_id       TEXT NOT NULL,
  entity_name     TEXT NOT NULL,
  entity_slug     TEXT,
  schema_id       TEXT,
  changes         TEXT NOT NULL DEFAULT '{}',
  metadata        TEXT NOT NULL DEFAULT '{}',
  dedupe_key      TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO audit_log_new (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata, dedupe_key)
  SELECT id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata, dedupe_key
  FROM audit_log;
DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;
CREATE INDEX audit_log_workspace_timestamp_idx ON audit_log(workspace, timestamp DESC);
CREATE UNIQUE INDEX audit_log_dedupe_idx
  ON audit_log(workspace, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

PRAGMA foreign_keys = ON;
