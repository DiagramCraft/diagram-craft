-- Add created_by_name column to entity_snapshot table
ALTER TABLE entity_snapshot ADD COLUMN created_by_name TEXT;

-- Populate created_by_name from users table
UPDATE entity_snapshot
SET created_by_name = (
  SELECT display_name
  FROM users
  WHERE users.id = entity_snapshot.created_by
);
