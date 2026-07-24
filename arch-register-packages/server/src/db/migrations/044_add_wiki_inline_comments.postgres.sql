-- @creates wiki_inline_comment
CREATE TABLE IF NOT EXISTS wiki_inline_comment (
  id              UUID        PRIMARY KEY,
  workspace       UUID        NOT NULL,
  node_id         UUID        NOT NULL,
  parent_post_id  UUID,
  author_id       UUID,
  body            TEXT        NOT NULL,
  quote           TEXT        NOT NULL,
  prefix          TEXT        NOT NULL,
  suffix          TEXT        NOT NULL,
  anchor_start    INTEGER     NOT NULL,
  anchor_end      INTEGER     NOT NULL,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  edited_at       TIMESTAMPTZ,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_post_id) REFERENCES wiki_inline_comment(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS wiki_inline_comment_node_idx ON wiki_inline_comment(workspace, node_id);
CREATE INDEX IF NOT EXISTS wiki_inline_comment_parent_idx ON wiki_inline_comment(parent_post_id);
