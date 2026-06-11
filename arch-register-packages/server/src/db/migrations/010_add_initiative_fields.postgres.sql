-- @creates project_entity_type
-- @creates project_entity
ALTER TABLE project
  DROP CONSTRAINT IF EXISTS project_status_check,
  ADD COLUMN target_date TEXT,
  ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE project
  ADD CONSTRAINT project_status_check CHECK (status IN ('draft', 'active', 'complete', 'cancelled'));

UPDATE project SET pinned = TRUE WHERE status = 'pinned';
UPDATE project SET status = 'active' WHERE status IN ('pinned', 'archived');

CREATE TABLE project_entity_type (
  id         UUID        PRIMARY KEY,
  workspace  UUID        NOT NULL,
  label      TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX project_entity_type_workspace_idx ON project_entity_type(workspace);

CREATE TABLE project_entity (
  workspace   UUID        NOT NULL,
  project_id  UUID        NOT NULL,
  entity_id   UUID        NOT NULL,
  entity_type UUID,
  is_done     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace, project_id, entity_id),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_type) REFERENCES project_entity_type(workspace, id) ON DELETE SET NULL
);

CREATE INDEX project_entity_workspace_project_idx ON project_entity(workspace, project_id);
CREATE INDEX project_entity_workspace_entity_idx ON project_entity(workspace, entity_id);
