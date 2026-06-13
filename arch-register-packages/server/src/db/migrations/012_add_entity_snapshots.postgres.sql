-- @creates entity_snapshot
CREATE TABLE entity_snapshot (
  id             UUID PRIMARY KEY,
  workspace      UUID NOT NULL,
  entity_id      UUID NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('autosave', 'saved_version', 'future_update', 'applied')),
  project_id     UUID,
  target_date    DATE,
  commit_message TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID NOT NULL,
  base_state     JSONB NOT NULL,
  proposed_state JSONB,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX entity_snapshot_entity_idx ON entity_snapshot(workspace, entity_id, created_at DESC);
CREATE INDEX entity_snapshot_project_idx ON entity_snapshot(project_id) WHERE project_id IS NOT NULL;
