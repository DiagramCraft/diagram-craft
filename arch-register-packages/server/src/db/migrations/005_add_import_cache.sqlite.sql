-- Migration: Add import_cache table for temporary storage of import data
-- This table stores parsed import data between the parse and execute phases

CREATE TABLE IF NOT EXISTS import_cache (
  import_id       TEXT        PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  manifest        TEXT        NOT NULL,
  data            TEXT        NOT NULL,
  content_files   TEXT,
  created_at      TEXT        NOT NULL,
  expires_at      TEXT        NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS import_cache_expires_idx ON import_cache(expires_at);

-- Index for user/workspace lookups
CREATE INDEX IF NOT EXISTS import_cache_ws_user_idx ON import_cache(workspace_id, user_id);
