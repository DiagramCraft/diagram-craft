-- @alters api_token
ALTER TABLE api_token ADD COLUMN IF NOT EXISTS created_by_name TEXT;

UPDATE api_token t
SET created_by_name = u.display_name
FROM users u
WHERE t.created_by = u.id AND t.created_by_name IS NULL;

ALTER TABLE api_token DROP CONSTRAINT IF EXISTS api_token_created_by_fkey;
ALTER TABLE api_token ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE api_token
  ADD CONSTRAINT api_token_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO users (
  id, user_id, email, display_name, auth_provider, password_hash,
  is_active, is_system_actor, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-0000000000a3', 'system:removed-token-owner', NULL,
  'Removed user', 'local', NULL, true, true, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;
