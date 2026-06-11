-- @creates project_entity_type
-- @creates project_entity
PRAGMA foreign_keys = OFF;

ALTER TABLE project ADD COLUMN target_date TEXT;
ALTER TABLE project ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

UPDATE project SET pinned = 1 WHERE status = 'pinned';
UPDATE project SET status = 'active' WHERE status IN ('pinned', 'archived');

CREATE TABLE project_new (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'complete', 'cancelled')),
  color       TEXT,
  target_date TEXT,
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

INSERT INTO project_new (id, workspace, name, description, owner, status, color, target_date, pinned, created_at, updated_at)
  SELECT id, workspace, name, description, owner, status, color, target_date, pinned, created_at, updated_at
  FROM project;

DROP TABLE project;
ALTER TABLE project_new RENAME TO project;

CREATE TABLE project_entity_type (
  id         TEXT    PRIMARY KEY,
  workspace  TEXT    NOT NULL,
  label      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX project_entity_type_workspace_idx ON project_entity_type(workspace);

CREATE TABLE project_entity (
  workspace   TEXT    NOT NULL,
  project_id  TEXT    NOT NULL,
  entity_id   TEXT    NOT NULL,
  entity_type TEXT,
  is_done     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (workspace, project_id, entity_id),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_type) REFERENCES project_entity_type(workspace, id) ON DELETE SET NULL
);

CREATE INDEX project_entity_workspace_project_idx ON project_entity(workspace, project_id);
CREATE INDEX project_entity_workspace_entity_idx ON project_entity(workspace, entity_id);

PRAGMA foreign_keys = ON;
