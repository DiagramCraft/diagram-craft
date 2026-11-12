-- @creates schema_publication
CREATE TABLE schema_publication (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  author UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL,
  migration_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (workspace, number)
);

CREATE INDEX schema_publication_workspace_idx ON schema_publication(workspace, number DESC);
