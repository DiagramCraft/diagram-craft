-- @creates assessment_response
CREATE TABLE IF NOT EXISTS assessment_response (
  id            TEXT PRIMARY KEY,
  workspace     TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  "values"      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  updated_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workspace, assessment_id, entity_id),
  FOREIGN KEY (assessment_id) REFERENCES assessment(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS assessment_response_assessment_idx ON assessment_response(workspace, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_response_entity_idx ON assessment_response(workspace, entity_id);
