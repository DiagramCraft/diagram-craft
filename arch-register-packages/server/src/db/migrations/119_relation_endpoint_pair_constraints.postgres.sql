-- Relation endpoint-pair uniqueness (#2984).
-- The flag is disabled for existing schemas so this migration preserves current behavior.

ALTER TABLE relation_schema
  ADD COLUMN IF NOT EXISTS unique_endpoint_pair BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE relation_schema_version
  ADD COLUMN IF NOT EXISTS unique_endpoint_pair BOOLEAN NOT NULL DEFAULT FALSE;

-- Keys are materialized only for schemas whose flag is enabled. Keeping the invariant in a
-- dedicated table allows a database unique constraint to arbitrate concurrent relation creates
-- without changing the default semantics for existing relation schemas.
CREATE TABLE IF NOT EXISTS relation_endpoint_pair_key (
  workspace     UUID NOT NULL,
  schema_id     UUID NOT NULL,
  in_entity_id  UUID NOT NULL,
  out_entity_id UUID NOT NULL,
  relation_id   UUID NOT NULL,
  CONSTRAINT relation_endpoint_pair_key_pk
    PRIMARY KEY (workspace, schema_id, in_entity_id, out_entity_id),
  CONSTRAINT relation_endpoint_pair_key_relation_uq
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
