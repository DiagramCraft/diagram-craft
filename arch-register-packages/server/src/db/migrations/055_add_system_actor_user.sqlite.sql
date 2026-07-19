ALTER TABLE users ADD COLUMN is_system_actor INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO users (
  id, user_id, email, display_name, auth_provider, password_hash,
  is_active, is_system_actor, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-0000000000a1', 'system:ai-metadata-generator', NULL,
  'AI Metadata Generator', 'local', NULL, 0, 1, datetime('now'), datetime('now')
);
