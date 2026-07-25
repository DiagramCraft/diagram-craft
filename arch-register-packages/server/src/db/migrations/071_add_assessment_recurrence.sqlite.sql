PRAGMA foreign_keys = OFF;

ALTER TABLE assessment ADD COLUMN recurrence TEXT NOT NULL DEFAULT '{"type":"none"}';
ALTER TABLE assessment ADD COLUMN response_window_days INTEGER;
ALTER TABLE assessment ADD COLUMN current_occurrence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assessment ADD COLUMN pending_occurrence_job_run_id TEXT;
ALTER TABLE assessment ADD COLUMN next_occurrence_at TEXT;

CREATE TABLE assessment_response_new (
  id            TEXT PRIMARY KEY,
  workspace     TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  occurrence    INTEGER NOT NULL DEFAULT 1,
  "values"      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  updated_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workspace, assessment_id, entity_id, occurrence),
  FOREIGN KEY (assessment_id) REFERENCES assessment(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

INSERT INTO assessment_response_new (id, workspace, assessment_id, entity_id, occurrence, "values", created_at, updated_at, updated_by)
  SELECT id, workspace, assessment_id, entity_id, 1, "values", created_at, updated_at, updated_by
  FROM assessment_response;

DROP TABLE assessment_response;
ALTER TABLE assessment_response_new RENAME TO assessment_response;

CREATE INDEX IF NOT EXISTS assessment_response_assessment_idx ON assessment_response(workspace, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_response_entity_idx ON assessment_response(workspace, entity_id);

PRAGMA foreign_keys = ON;
