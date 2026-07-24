-- System user that owns API tokens created from the Workspace Admin > API
-- Tokens section, as opposed to personal tokens owned by a real user.
INSERT INTO users (
  id, user_id, email, display_name, auth_provider, password_hash,
  is_active, is_system_actor, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-0000000000a3', 'system:workspace-token-owner', NULL,
  'Workspace', 'local', NULL, true, true, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;
