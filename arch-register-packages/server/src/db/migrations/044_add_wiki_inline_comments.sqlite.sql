-- @creates wiki_inline_comment
CREATE TABLE IF NOT EXISTS wiki_inline_comment (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  node_id         TEXT NOT NULL,
  parent_post_id  TEXT,
  author_id       TEXT,
  body            TEXT NOT NULL,
  quote           TEXT NOT NULL,
  prefix          TEXT NOT NULL,
  suffix          TEXT NOT NULL,
  anchor_start    INTEGER NOT NULL,
  anchor_end      INTEGER NOT NULL,
  resolved_at     TEXT,
  resolved_by     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  edited_at       TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_post_id) REFERENCES wiki_inline_comment(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS wiki_inline_comment_node_idx ON wiki_inline_comment(workspace, node_id);
CREATE INDEX IF NOT EXISTS wiki_inline_comment_parent_idx ON wiki_inline_comment(parent_post_id);
