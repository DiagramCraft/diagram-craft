ALTER TABLE document_type ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- @creates document_type_version
CREATE TABLE IF NOT EXISTS document_type_version (
  id                UUID PRIMARY KEY,
  workspace         UUID NOT NULL,
  document_type_id  UUID NOT NULL,
  version           INTEGER NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  fields            JSONB NOT NULL DEFAULT '[]',
  color             TEXT,
  icon              TEXT,
  change_summary    JSONB NOT NULL DEFAULT '{}',
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, document_type_id, version),
  FOREIGN KEY (workspace, document_type_id) REFERENCES document_type(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_type_version_workspace_type_idx ON document_type_version(workspace, document_type_id, version DESC);
