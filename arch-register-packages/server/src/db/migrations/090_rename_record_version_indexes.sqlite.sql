-- #2734: record_version's indexes still carried their pre-087 entity_version
-- naming even though the table and column were renamed. Bring them in line.
-- sqlite has no ALTER INDEX RENAME, so drop and recreate.

DROP INDEX entity_version_entity_idx;
CREATE INDEX record_version_record_idx ON record_version(workspace, record_id, created_at DESC);

DROP INDEX entity_version_case_revision_idx;
CREATE INDEX record_version_case_revision_idx ON record_version(applied_case_revision_id)
  WHERE applied_case_revision_id IS NOT NULL;

DROP INDEX entity_version_entity_time_idx;
CREATE INDEX record_version_record_time_idx
  ON record_version(workspace, record_id, created_at DESC, version_number DESC);
