ALTER TABLE entity_schema ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- @creates entity_schema_version
CREATE TABLE IF NOT EXISTS entity_schema_version (
  id             UUID PRIMARY KEY,
  workspace      UUID NOT NULL,
  schema_id      UUID NOT NULL,
  version        INTEGER NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  fields         JSONB NOT NULL DEFAULT '[]',
  templates      JSONB NOT NULL DEFAULT '[]',
  color          TEXT,
  icon           TEXT,
  change_summary JSONB NOT NULL DEFAULT '{}',
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, schema_id, version),
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS entity_schema_version_workspace_schema_idx ON entity_schema_version(workspace, schema_id, version DESC);
