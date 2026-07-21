ALTER TABLE document_field DROP CONSTRAINT IF EXISTS document_field_type_check;
ALTER TABLE document_field ADD CONSTRAINT document_field_type_check
  CHECK (type IN ('text', 'long_text', 'boolean', 'date', 'number', 'enum', 'entity_link', 'document_link', 'user_link', 'team_link'));

-- @creates document_workflow_request
CREATE TABLE document_workflow_request (
  id                  UUID PRIMARY KEY,
  workspace           UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  node_id             UUID NOT NULL REFERENCES content_node(id) ON DELETE CASCADE,
  field_id            TEXT NOT NULL,
  case_id             UUID NOT NULL UNIQUE REFERENCES governance_case(id) ON DELETE CASCADE,
  previous_value      TEXT NOT NULL,
  target_value        TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'changes_requested', 'approved', 'rejected', 'superseded', 'blocked')),
  required_approvals  INTEGER NOT NULL,
  resolved_slots      JSONB NOT NULL DEFAULT '[]',
  policy_snapshot     JSONB NOT NULL DEFAULT '{}',
  source_revision     INTEGER,
  initiator_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  resolved_at         TIMESTAMPTZ,
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE INDEX document_workflow_request_node_idx
  ON document_workflow_request(workspace, node_id, field_id, created_at DESC);
CREATE INDEX document_workflow_request_case_idx
  ON document_workflow_request(workspace, case_id);
CREATE UNIQUE INDEX document_workflow_request_current_idx
  ON document_workflow_request(workspace, node_id, field_id)
  WHERE status IN ('pending', 'changes_requested', 'blocked');
