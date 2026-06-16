-- @creates content_node_revision
CREATE TABLE content_node_revision (
  id                        UUID PRIMARY KEY,
  workspace                 UUID NOT NULL,
  node_id                   UUID NOT NULL,
  revision_number           INTEGER NOT NULL,
  title                     TEXT,
  body                      TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID,
  restored_from_revision_id UUID,
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (restored_from_revision_id) REFERENCES content_node_revision(id) ON DELETE SET NULL,
  UNIQUE (workspace, node_id, revision_number)
);

CREATE INDEX content_node_revision_node_idx
  ON content_node_revision(workspace, node_id, created_at DESC);
CREATE INDEX content_node_revision_number_idx
  ON content_node_revision(workspace, node_id, revision_number DESC);
