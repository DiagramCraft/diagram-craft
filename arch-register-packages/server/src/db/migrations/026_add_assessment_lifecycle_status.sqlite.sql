PRAGMA foreign_keys = OFF;

CREATE TABLE assessment_new (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  scope       TEXT NOT NULL DEFAULT '[]',
  fields      TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE
);

INSERT INTO assessment_new (id, workspace, project_id, name, description, status, scope, fields, created_at, updated_at)
  SELECT id, workspace, project_id, name, description,
         CASE WHEN status = 'active' THEN 'open' ELSE status END,
         scope, fields, created_at, updated_at
  FROM assessment;

DROP TABLE assessment;
ALTER TABLE assessment_new RENAME TO assessment;

CREATE INDEX IF NOT EXISTS assessment_workspace_project_idx ON assessment(workspace, project_id);

PRAGMA foreign_keys = ON;
