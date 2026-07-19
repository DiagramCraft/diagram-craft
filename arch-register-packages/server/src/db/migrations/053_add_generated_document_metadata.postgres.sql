ALTER TABLE document_type_version ADD COLUMN IF NOT EXISTS ai_actions JSONB NOT NULL DEFAULT '[]';
ALTER TABLE content_node_document ADD COLUMN IF NOT EXISTS generated_metadata JSONB NOT NULL DEFAULT '{}';
