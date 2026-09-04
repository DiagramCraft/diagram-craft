-- Preserve retired entity identifiers after a merge (#3163).
-- The retired record is intentionally not a foreign key: the source catalog row can be
-- removed by the merge apply step while this table remains the redirect history.

CREATE TABLE catalog_record_merge (
  merged_record_id    TEXT NOT NULL PRIMARY KEY,
  workspace           TEXT NOT NULL,
  canonical_record_id TEXT NOT NULL,
  merged_public_id    TEXT,
  merged_slug         TEXT NOT NULL,
  merged_namespace    TEXT NOT NULL,
  merged_schema_id    TEXT NOT NULL,
  merged_at           TEXT NOT NULL,
  merged_by           TEXT,
  merge_id            TEXT NOT NULL,
  UNIQUE (merged_public_id),
  CHECK (merged_record_id <> canonical_record_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, canonical_record_id)
    REFERENCES catalog_record(workspace, id) ON DELETE RESTRICT,
  FOREIGN KEY (merged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX catalog_record_merge_workspace_canonical_idx
  ON catalog_record_merge(workspace, canonical_record_id);
CREATE INDEX catalog_record_merge_workspace_public_idx
  ON catalog_record_merge(workspace, merged_public_id);
