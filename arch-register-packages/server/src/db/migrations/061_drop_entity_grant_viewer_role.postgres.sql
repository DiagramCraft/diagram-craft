UPDATE entity_grant SET role = 'editor' WHERE role = 'viewer';

ALTER TABLE entity_grant DROP CONSTRAINT IF EXISTS entity_grant_role_check;
ALTER TABLE entity_grant ADD CONSTRAINT entity_grant_role_check
  CHECK (role IN ('editor', 'contributor', 'entity_admin'));
