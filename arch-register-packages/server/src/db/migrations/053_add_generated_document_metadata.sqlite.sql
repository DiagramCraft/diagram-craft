ALTER TABLE document_type_version ADD COLUMN ai_actions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE content_node_document ADD COLUMN generated_metadata TEXT NOT NULL DEFAULT '{}';
