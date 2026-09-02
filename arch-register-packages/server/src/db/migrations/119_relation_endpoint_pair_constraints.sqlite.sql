-- Relation endpoint-pair uniqueness (#2984).
-- The flag is disabled for existing schemas so this migration preserves current behavior.

ALTER TABLE relation_schema ADD COLUMN unique_endpoint_pair INTEGER NOT NULL DEFAULT 0;
ALTER TABLE relation_schema_version ADD COLUMN unique_endpoint_pair INTEGER NOT NULL DEFAULT 0;

-- Keys are materialized only for schemas whose flag is enabled. Keeping the invariant in a
-- dedicated table allows a database unique constraint to arbitrate concurrent relation creates
-- without changing the default semantics for existing relation schemas.
CREATE TABLE relation_endpoint_pair_key (
  workspace     TEXT NOT NULL,
  schema_id     TEXT NOT NULL,
  in_entity_id  TEXT NOT NULL,
  out_entity_id TEXT NOT NULL,
  relation_id   TEXT NOT NULL,
  PRIMARY KEY (workspace, schema_id, in_entity_id, out_entity_id),
  UNIQUE (workspace, relation_id),
  FOREIGN KEY (workspace, schema_id)
    REFERENCES relation_schema(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, in_entity_id)
    REFERENCES catalog_record(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, out_entity_id)
    REFERENCES catalog_record(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, relation_id)
    REFERENCES catalog_record(workspace, id) ON DELETE CASCADE
);
