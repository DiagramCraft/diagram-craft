-- @creates entity_external_identity
CREATE TABLE entity_external_identity (
  workspace     UUID        NOT NULL,
  source        TEXT        NOT NULL,
  external_key  TEXT        NOT NULL,
  entity_id     UUID        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace, source, external_key),
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX entity_external_identity_entity_idx ON entity_external_identity(workspace, entity_id);
