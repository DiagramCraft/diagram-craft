ALTER TABLE entity_schema ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- @creates entity_schema_version
CREATE TABLE IF NOT EXISTS entity_schema_version (
  id             TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL,
  schema_id      TEXT NOT NULL,
  version        INTEGER NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  fields         TEXT NOT NULL DEFAULT '[]',
  templates      TEXT NOT NULL DEFAULT '[]',
  color          TEXT,
  icon           TEXT,
  change_summary TEXT NOT NULL DEFAULT '{}',
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (workspace, schema_id, version),
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS entity_schema_version_workspace_schema_idx ON entity_schema_version(workspace, schema_id, version DESC);
