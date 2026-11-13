ALTER TABLE entity_schema_version ADD COLUMN publication_id TEXT REFERENCES schema_publication(id) ON DELETE SET NULL;
ALTER TABLE relation_schema_version ADD COLUMN publication_id TEXT REFERENCES schema_publication(id) ON DELETE SET NULL;
ALTER TABLE document_type_version ADD COLUMN publication_id TEXT REFERENCES schema_publication(id) ON DELETE SET NULL;
