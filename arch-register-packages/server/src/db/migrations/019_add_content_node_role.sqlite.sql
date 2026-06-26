ALTER TABLE content_node
ADD COLUMN role TEXT CHECK (role IN ('attachment-container'));
