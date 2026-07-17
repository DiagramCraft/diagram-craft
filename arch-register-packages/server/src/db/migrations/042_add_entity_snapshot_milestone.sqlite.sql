PRAGMA foreign_keys = OFF;

CREATE TABLE entity_snapshot_new (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('autosave', 'saved_version', 'future_update', 'applied', 'deleted')),
  project_id      TEXT,
  target_date     TEXT,
  milestone_id    TEXT,
  commit_message  TEXT,
  created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  created_by      TEXT NOT NULL,
  created_by_name TEXT,
  base_state      TEXT NOT NULL,
  proposed_state  TEXT,
  CHECK (NOT (milestone_id IS NOT NULL AND target_date IS NOT NULL)),
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (milestone_id) REFERENCES project_milestone(id) ON DELETE SET NULL
);

INSERT INTO entity_snapshot_new (id, workspace, entity_id, status, project_id, target_date, commit_message, created_at, created_by, created_by_name, base_state, proposed_state)
  SELECT id, workspace, entity_id, status, project_id, target_date, commit_message, created_at, created_by, created_by_name, base_state, proposed_state
  FROM entity_snapshot;

DROP TABLE entity_snapshot;
ALTER TABLE entity_snapshot_new RENAME TO entity_snapshot;

CREATE INDEX entity_snapshot_entity_idx ON entity_snapshot(workspace, entity_id, created_at DESC);
CREATE INDEX entity_snapshot_project_idx ON entity_snapshot(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX entity_snapshot_milestone_idx ON entity_snapshot(milestone_id) WHERE milestone_id IS NOT NULL;

PRAGMA foreign_keys = ON;
