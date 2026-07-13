-- @creates discussion_post
CREATE TABLE IF NOT EXISTS discussion_post (
  id              UUID        PRIMARY KEY,
  workspace       UUID        NOT NULL,
  object_type     TEXT        NOT NULL CHECK (object_type IN ('content_node', 'assessment', 'entity')),
  object_id       UUID        NOT NULL,
  parent_post_id  UUID,
  author_id       UUID,
  body            TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  edited_at       TIMESTAMPTZ,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_post_id) REFERENCES discussion_post(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS discussion_post_object_idx ON discussion_post(workspace, object_type, object_id);
CREATE INDEX IF NOT EXISTS discussion_post_parent_idx ON discussion_post(parent_post_id);
