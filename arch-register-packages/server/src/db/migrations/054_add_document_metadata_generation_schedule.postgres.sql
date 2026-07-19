-- @creates document_metadata_generation_schedule
CREATE TABLE document_metadata_generation_schedule (
  workspace            UUID NOT NULL,
  node_id              UUID NOT NULL,
  action_id            TEXT NOT NULL,
  run_after_at         TIMESTAMPTZ NOT NULL,
  source_revision      INTEGER NOT NULL,
  generator_version    INTEGER NOT NULL,
  scheduled_by_user_id UUID NOT NULL,
  attempt_count        INTEGER NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, node_id, action_id),
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE INDEX document_metadata_generation_schedule_due_idx
  ON document_metadata_generation_schedule(workspace, run_after_at);
