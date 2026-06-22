-- Add created_by_name column to entity_snapshot table
ALTER TABLE entity_snapshot ADD COLUMN created_by_name TEXT;

-- Populate created_by_name from users table
UPDATE entity_snapshot es
SET created_by_name = u.display_name
FROM users u
WHERE es.created_by = u.id;
