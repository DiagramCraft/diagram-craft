-- @creates entity_external_identity
CREATE TABLE entity_external_identity (
  workspace     TEXT NOT NULL,
  source        TEXT NOT NULL,
  external_key  TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace, source, external_key),
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX entity_external_identity_entity_idx ON entity_external_identity(workspace, entity_id);
