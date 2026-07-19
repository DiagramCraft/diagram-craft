ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_actor BOOLEAN NOT NULL DEFAULT false;

INSERT INTO users (
  id, user_id, email, display_name, auth_provider, password_hash,
  is_active, is_system_actor, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-0000000000a1', 'system:ai-metadata-generator', NULL,
  'AI Metadata Generator', 'local', NULL, false, true, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;
