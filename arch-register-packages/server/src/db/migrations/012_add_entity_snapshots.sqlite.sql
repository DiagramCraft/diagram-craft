-- @creates entity_snapshot
CREATE TABLE entity_snapshot (
  id             TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('autosave', 'saved_version', 'future_update', 'applied')),
  project_id     TEXT,
  target_date    TEXT,
  commit_message TEXT,
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  base_state     TEXT NOT NULL,
  proposed_state TEXT,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX entity_snapshot_entity_idx ON entity_snapshot(workspace, entity_id, created_at DESC);
CREATE INDEX entity_snapshot_project_idx ON entity_snapshot(project_id) WHERE project_id IS NOT NULL;
