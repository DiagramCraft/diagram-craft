-- @creates discussion_post
CREATE TABLE IF NOT EXISTS discussion_post (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  object_type     TEXT NOT NULL CHECK (object_type IN ('content_node', 'assessment', 'entity')),
  object_id       TEXT NOT NULL,
  parent_post_id  TEXT,
  author_id       TEXT,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  edited_at       TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_post_id) REFERENCES discussion_post(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS discussion_post_object_idx ON discussion_post(workspace, object_type, object_id);
CREATE INDEX IF NOT EXISTS discussion_post_parent_idx ON discussion_post(parent_post_id);
