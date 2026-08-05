-- Add relation-specific indexes after relation instances moved into catalog_record (#2724).
-- The partial predicates keep entity rows and soft-deleted relations out of these indexes.

CREATE INDEX catalog_record_relation_workspace_schema_created_idx
  ON catalog_record(workspace, schema_id, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;

CREATE INDEX catalog_record_relation_workspace_in_created_idx
  ON catalog_record(workspace, in_record_id, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;

CREATE INDEX catalog_record_relation_workspace_out_created_idx
  ON catalog_record(workspace, out_record_id, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;

CREATE INDEX catalog_record_relation_workspace_created_idx
  ON catalog_record(workspace, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;
