-- @creates document_workflow_request
PRAGMA foreign_keys = OFF;

CREATE TABLE document_field_new (
  id                TEXT NOT NULL,
  workspace         TEXT NOT NULL,
  document_type_id  TEXT NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('text', 'long_text', 'boolean', 'date', 'number', 'enum', 'entity_link', 'document_link', 'user_link', 'team_link')),
  requirement       TEXT NOT NULL CHECK (requirement IN ('required', 'expected', 'optional')),
  min_cardinality   INTEGER,
  max_cardinality   INTEGER,
  enum_options      TEXT NOT NULL DEFAULT '[]',
  inverse_name      TEXT,
  retired           INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (workspace, document_type_id, id),
  FOREIGN KEY (workspace, document_type_id) REFERENCES document_type(workspace, id) ON DELETE CASCADE
);

INSERT INTO document_field_new
  SELECT id, workspace, document_type_id, name, type, requirement, min_cardinality,
         max_cardinality, enum_options, inverse_name, retired, created_at, updated_at
  FROM document_field;

DROP TABLE document_field;
ALTER TABLE document_field_new RENAME TO document_field;

CREATE TABLE document_workflow_request (
  id                  TEXT PRIMARY KEY,
  workspace           TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  node_id             TEXT NOT NULL REFERENCES content_node(id) ON DELETE CASCADE,
  field_id            TEXT NOT NULL,
  case_id             TEXT NOT NULL UNIQUE REFERENCES governance_case(id) ON DELETE CASCADE,
  previous_value      TEXT NOT NULL,
  target_value        TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'changes_requested', 'approved', 'rejected', 'superseded', 'blocked')),
  required_approvals  INTEGER NOT NULL,
  resolved_slots      TEXT NOT NULL DEFAULT '[]',
  policy_snapshot     TEXT NOT NULL DEFAULT '{}',
  source_revision     INTEGER,
  initiator_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL,
  resolved_at         TEXT,
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE INDEX document_workflow_request_node_idx
  ON document_workflow_request(workspace, node_id, field_id, created_at DESC);
CREATE INDEX document_workflow_request_case_idx
  ON document_workflow_request(workspace, case_id);
CREATE UNIQUE INDEX document_workflow_request_current_idx
  ON document_workflow_request(workspace, node_id, field_id)
  WHERE status IN ('pending', 'changes_requested', 'blocked');

PRAGMA foreign_keys = ON;
