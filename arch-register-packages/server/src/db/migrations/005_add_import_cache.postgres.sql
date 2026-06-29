-- Migration: Add import_cache table for temporary storage of import data
-- This table stores parsed import data between the parse and execute phases

CREATE TABLE IF NOT EXISTS import_cache (
  import_id       UUID        PRIMARY KEY,
  workspace_id    UUID        NOT NULL,
  user_id         UUID        NOT NULL,
  manifest        JSONB       NOT NULL,
  data            JSONB       NOT NULL,
  content_files   JSONB,
  created_at      TIMESTAMPTZ NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for cleanup of expired entries
CREATE INDEX import_cache_expires_idx ON import_cache(expires_at);

-- Index for user/workspace lookups
CREATE INDEX import_cache_ws_user_idx ON import_cache(workspace_id, user_id);
