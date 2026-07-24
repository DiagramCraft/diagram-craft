PRAGMA foreign_keys = OFF;

UPDATE entity_grant SET role = 'editor' WHERE role = 'viewer';

CREATE TABLE entity_grant_new (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  principal_type  TEXT NOT NULL CHECK (principal_type IN ('user', 'team')),
  principal_id    TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('editor', 'contributor', 'entity_admin')),
  applies_to      TEXT NOT NULL CHECK (applies_to IN ('self', 'subtree')),
  created_at      TEXT NOT NULL,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

INSERT INTO entity_grant_new (id, workspace, entity_id, principal_type, principal_id, role, applies_to, created_at)
  SELECT id, workspace, entity_id, principal_type, principal_id, role, applies_to, created_at
  FROM entity_grant;

DROP TABLE entity_grant;
ALTER TABLE entity_grant_new RENAME TO entity_grant;

CREATE INDEX entity_grant_workspace_entity_idx ON entity_grant(workspace, entity_id);
CREATE INDEX entity_grant_workspace_principal_idx ON entity_grant(workspace, principal_type, principal_id);

PRAGMA foreign_keys = ON;
