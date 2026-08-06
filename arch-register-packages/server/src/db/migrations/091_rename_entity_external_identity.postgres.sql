-- #2732: entity_external_identity already FKs transitively into the shared catalog_record
-- table (post-#2686 unification), so generalize its naming to support relation identities
-- too instead of adding a parallel table.

ALTER TABLE entity_external_identity RENAME TO catalog_record_external_identity;
ALTER TABLE catalog_record_external_identity RENAME COLUMN entity_id TO record_id;
ALTER INDEX entity_external_identity_entity_idx RENAME TO catalog_record_external_identity_record_idx;
