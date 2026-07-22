-- The target entity_version/change-case model is now authoritative.
-- Legacy tables are intentionally removed after 063; fresh bootstrap data is seeded into the target model.

DROP TABLE IF EXISTS entity_change_proposal_revision;
DROP TABLE IF EXISTS entity_change_proposal;
DROP TABLE IF EXISTS entity_snapshot;
