-- @creates assessment_response
CREATE TABLE IF NOT EXISTS assessment_response (
  id            UUID PRIMARY KEY,
  workspace     UUID NOT NULL,
  assessment_id UUID NOT NULL,
  entity_id     UUID NOT NULL,
  "values"      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workspace, assessment_id, entity_id),
  FOREIGN KEY (assessment_id) REFERENCES assessment(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS assessment_response_assessment_idx ON assessment_response(workspace, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_response_entity_idx ON assessment_response(workspace, entity_id);
