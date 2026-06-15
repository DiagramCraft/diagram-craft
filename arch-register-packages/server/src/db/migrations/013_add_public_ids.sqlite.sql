-- @creates public_id_prefix
CREATE TABLE public_id_prefix (
  prefix          TEXT PRIMARY KEY,
  owner_type      TEXT NOT NULL CHECK (owner_type IN ('workspace', 'schema')),
  owner_id        TEXT NOT NULL,
  next_number     INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX public_id_prefix_owner_idx ON public_id_prefix(owner_type, owner_id);

ALTER TABLE entity_schema ADD COLUMN key_prefix TEXT;
UPDATE entity_schema
SET key_prefix = CASE LOWER(name)
  WHEN 'domain' THEN 'DOM'
  WHEN 'system' THEN 'SYS'
  WHEN 'component' THEN 'CMP'
  WHEN 'api' THEN 'API'
  WHEN 'resource' THEN 'RES'
  WHEN 'application' THEN 'APP'
  WHEN 'service' THEN 'SVC'
  ELSE substr(upper(replace(name, ' ', '')), 1, 5)
END
WHERE key_prefix IS NULL;

CREATE TABLE entity_schema_new (
  id            TEXT PRIMARY KEY,
  workspace     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  fields        TEXT NOT NULL DEFAULT '[]',
  color         TEXT,
  icon          TEXT,
  default_owner TEXT,
  key_prefix    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  UNIQUE (key_prefix),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, default_owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

INSERT INTO entity_schema_new (id, workspace, name, description, fields, color, icon, default_owner, key_prefix, created_at, updated_at)
  SELECT id, workspace, name, COALESCE(description, ''), fields, color, icon, default_owner, key_prefix, created_at, updated_at
  FROM entity_schema;

DROP TABLE entity_schema;
ALTER TABLE entity_schema_new RENAME TO entity_schema;

ALTER TABLE entity ADD COLUMN public_id TEXT;
UPDATE entity
SET public_id = id
WHERE public_id IS NULL;

CREATE TABLE entity_new (
  id                    TEXT PRIMARY KEY,
  workspace             TEXT NOT NULL,
  public_id             TEXT NOT NULL UNIQUE,
  slug                  TEXT NOT NULL,
  namespace             TEXT NOT NULL DEFAULT 'default',
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  owner                 TEXT,
  lifecycle             TEXT,
  target_lifecycle      TEXT,
  target_lifecycle_date TEXT,
  tags                  TEXT NOT NULL DEFAULT '[]',
  links                 TEXT NOT NULL DEFAULT '[]',
  schema_id             TEXT NOT NULL,
  data                  TEXT NOT NULL DEFAULT '{}',
  visibility_mode       TEXT CHECK (visibility_mode IN ('public', 'restricted')),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (workspace, schema_id, namespace, slug),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, target_lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE RESTRICT
);

INSERT INTO entity_new (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, visibility_mode, created_at, updated_at)
  SELECT id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, visibility_mode, created_at, updated_at
  FROM entity;

DROP TABLE entity;
ALTER TABLE entity_new RENAME TO entity;

CREATE INDEX entity_workspace_schema_id_idx ON entity(workspace, schema_id);
CREATE INDEX entity_workspace_owner_idx ON entity(workspace, owner);
CREATE INDEX entity_workspace_lifecycle_idx ON entity(workspace, lifecycle);
CREATE INDEX entity_workspace_name_idx ON entity(workspace, name);
CREATE INDEX entity_workspace_visibility_mode_idx ON entity(workspace, visibility_mode);

ALTER TABLE project ADD COLUMN public_id TEXT;
UPDATE project
SET public_id = id
WHERE public_id IS NULL;

CREATE TABLE project_new (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  public_id   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'complete', 'cancelled')),
  color       TEXT,
  target_date TEXT,
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

INSERT INTO project_new (id, workspace, public_id, name, description, owner, status, color, target_date, pinned, created_at, updated_at)
  SELECT id, workspace, public_id, name, description, owner, status, color, target_date, pinned, created_at, updated_at
  FROM project;

DROP TABLE project;
ALTER TABLE project_new RENAME TO project;

INSERT INTO public_id_prefix (prefix, owner_type, owner_id, next_number, created_at, updated_at)
  SELECT short_code, 'workspace', id, 1, created_at, updated_at
  FROM workspace
  WHERE short_code GLOB '[A-Z][A-Z]' OR short_code GLOB '[A-Z][A-Z][A-Z]' OR short_code GLOB '[A-Z][A-Z][A-Z][A-Z]' OR short_code GLOB '[A-Z][A-Z][A-Z][A-Z][A-Z]';

INSERT INTO public_id_prefix (prefix, owner_type, owner_id, next_number, created_at, updated_at)
  SELECT key_prefix, 'schema', id, 1, created_at, updated_at
  FROM entity_schema;
