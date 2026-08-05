-- #2724: keep active typed-relation queries on relation-only indexes after the
-- relation table was unified into catalog_record.
--
-- The existing endpoint indexes intentionally include soft-deleted relations so
-- they remain useful for endpoint foreign-key cascade lookups. These indexes are
-- narrower and target active relation browsing, counting, and traversal.

CREATE INDEX catalog_record_relation_active_workspace_created_idx
  ON catalog_record (workspace, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;

CREATE INDEX catalog_record_relation_active_workspace_schema_created_idx
  ON catalog_record (workspace, schema_id, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;

CREATE INDEX catalog_record_relation_active_workspace_in_record_created_idx
  ON catalog_record (workspace, in_record_id, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;

CREATE INDEX catalog_record_relation_active_workspace_out_record_created_idx
  ON catalog_record (workspace, out_record_id, created_at DESC)
  WHERE kind = 'relation' AND deleted_at IS NULL;
