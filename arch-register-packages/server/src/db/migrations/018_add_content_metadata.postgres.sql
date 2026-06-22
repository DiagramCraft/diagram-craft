-- @creates content_metadata
CREATE TABLE content_metadata (
  workspace   UUID        NOT NULL,
  node_id     UUID        NOT NULL,
  title       TEXT,
  description TEXT,
  company     TEXT,
  category    TEXT,
  keywords    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, node_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE INDEX content_metadata_node_idx ON content_metadata(node_id);
