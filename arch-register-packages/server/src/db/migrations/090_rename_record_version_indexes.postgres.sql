-- #2734: record_version's indexes still carried their pre-087 entity_version
-- naming even though the table and column were renamed. Bring them in line.

ALTER INDEX entity_version_entity_idx RENAME TO record_version_record_idx;
ALTER INDEX entity_version_case_revision_idx RENAME TO record_version_case_revision_idx;
ALTER INDEX entity_version_entity_time_idx RENAME TO record_version_record_time_idx;
