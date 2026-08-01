-- Relation instances (#2569): first-class, persisted records for typed relations, parallel to
-- entity. Versioning/audit-history and approval-case workflow are deferred to #2574.

-- @creates relation
CREATE TABLE relation (
  id                       TEXT PRIMARY KEY,
  workspace                TEXT NOT NULL,
  schema_id                TEXT NOT NULL,
  in_entity_id             TEXT NOT NULL,
  out_entity_id            TEXT NOT NULL,
  data                     TEXT NOT NULL DEFAULT '{}',
  version                  INTEGER NOT NULL DEFAULT 1,
  approval_policy_override TEXT
    CHECK (approval_policy_override IN ('required', 'disabled')),
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  UNIQUE (workspace, id),
  CHECK (in_entity_id <> out_entity_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, schema_id) REFERENCES relation_schema(workspace, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, in_entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, out_entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX relation_workspace_schema_idx ON relation(workspace, schema_id);
CREATE INDEX relation_in_entity_idx ON relation(workspace, in_entity_id);
CREATE INDEX relation_out_entity_idx ON relation(workspace, out_entity_id);
