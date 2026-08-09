-- Assessment types now follow lifecycle-state replacement semantics: omitted rows are deleted.
-- SQLite requires table rebuilds to remove columns and add foreign keys.
PRAGMA foreign_keys = OFF;

UPDATE assessment
SET assessment_type_id = NULL
WHERE assessment_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_assessment_type
    WHERE workspace_assessment_type.workspace = assessment.workspace
      AND workspace_assessment_type.id = assessment.assessment_type_id
      AND workspace_assessment_type.is_active = 1
  );

DELETE FROM workspace_assessment_type
WHERE is_active = 0;

CREATE TABLE workspace_assessment_type_new (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

INSERT INTO workspace_assessment_type_new (id, workspace, name, sort_order, created_at, updated_at)
  SELECT id, workspace, name, sort_order, created_at, updated_at
  FROM workspace_assessment_type;

DROP TABLE workspace_assessment_type;
ALTER TABLE workspace_assessment_type_new RENAME TO workspace_assessment_type;

CREATE INDEX workspace_assessment_type_workspace_idx
  ON workspace_assessment_type(workspace, sort_order, id);

CREATE TABLE assessment_new (
  id                         TEXT PRIMARY KEY,
  workspace                  TEXT NOT NULL,
  project_id                 TEXT NOT NULL,
  name                       TEXT NOT NULL,
  description                TEXT NOT NULL DEFAULT '',
  status                     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  mode                       TEXT NOT NULL DEFAULT 'fields' CHECK (mode IN ('fields', 'confirm')),
  assessment_type_id        TEXT,
  scope                      TEXT NOT NULL DEFAULT '[]',
  scope_conditions          TEXT NOT NULL DEFAULT '[]',
  fields                    TEXT NOT NULL DEFAULT '[]',
  groups                    TEXT NOT NULL DEFAULT '[]',
  assigned_team_ids         TEXT NOT NULL DEFAULT '[]',
  due_at                    TEXT,
  recurrence                TEXT NOT NULL DEFAULT '{"type":"none"}',
  response_window_days      INTEGER,
  current_occurrence        INTEGER NOT NULL DEFAULT 1,
  pending_occurrence_job_run_id TEXT,
  next_occurrence_at        TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, assessment_type_id)
    REFERENCES workspace_assessment_type(workspace, id) ON DELETE SET NULL
);

INSERT INTO assessment_new (
  id, workspace, project_id, name, description, status, mode, assessment_type_id,
  scope, scope_conditions, fields, groups, assigned_team_ids, due_at, recurrence,
  response_window_days, current_occurrence, pending_occurrence_job_run_id,
  next_occurrence_at, created_at, updated_at
)
  SELECT
    id, workspace, project_id, name, description, status, mode, assessment_type_id,
    scope, scope_conditions, fields, groups, assigned_team_ids, due_at, recurrence,
    response_window_days, current_occurrence, pending_occurrence_job_run_id,
    next_occurrence_at, created_at, updated_at
  FROM assessment;

DROP TABLE assessment;
ALTER TABLE assessment_new RENAME TO assessment;

CREATE INDEX assessment_workspace_project_idx
  ON assessment(workspace, project_id);

PRAGMA foreign_keys = ON;
