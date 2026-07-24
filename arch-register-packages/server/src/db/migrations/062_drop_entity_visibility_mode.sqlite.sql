PRAGMA foreign_keys = OFF;

CREATE TABLE entity_new (
  id                     TEXT PRIMARY KEY,
  workspace              TEXT NOT NULL,
  public_id              TEXT NOT NULL UNIQUE,
  slug                   TEXT NOT NULL,
  namespace              TEXT NOT NULL DEFAULT 'default',
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  owner                  TEXT,
  lifecycle              TEXT,
  target_lifecycle       TEXT,
  target_lifecycle_date  TEXT,
  tags                   TEXT NOT NULL DEFAULT '[]',
  links                  TEXT NOT NULL DEFAULT '[]',
  schema_id              TEXT NOT NULL,
  data                   TEXT NOT NULL DEFAULT '{}',
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  deleted_at             DATETIME,
  version                INTEGER NOT NULL DEFAULT 1,
  approval_policy_override TEXT CHECK (approval_policy_override IN ('required', 'disabled')),
  generated_metadata     TEXT NOT NULL DEFAULT '{}',
  project_id             TEXT REFERENCES project(id) ON DELETE SET NULL,
  UNIQUE (workspace, schema_id, namespace, slug),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, target_lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE RESTRICT
);

INSERT INTO entity_new (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, created_at, updated_at, deleted_at, version, approval_policy_override, generated_metadata, project_id)
  SELECT id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, created_at, updated_at, deleted_at, version, approval_policy_override, generated_metadata, project_id
  FROM entity;

DROP TABLE entity;
ALTER TABLE entity_new RENAME TO entity;

CREATE INDEX entity_workspace_schema_id_idx ON entity(workspace, schema_id);
CREATE INDEX entity_workspace_owner_idx ON entity(workspace, owner);
CREATE INDEX entity_workspace_lifecycle_idx ON entity(workspace, lifecycle);
CREATE INDEX entity_workspace_name_idx ON entity(workspace, name);
CREATE INDEX entity_workspace_target_lifecycle_idx ON entity(workspace, target_lifecycle);
CREATE INDEX entity_workspace_project_id_idx ON entity(workspace, project_id);

PRAGMA foreign_keys = ON;
