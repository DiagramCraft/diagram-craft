PRAGMA foreign_keys = ON;

CREATE TABLE workspace (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  url_slug    TEXT NOT NULL UNIQUE,
  short_code  TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE workspace_lifecycle_state (
  id          TEXT NOT NULL,
  workspace   TEXT NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'var(--fg-3)',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE workspace_owner (
  id          TEXT NOT NULL,
  workspace   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE entity_schema (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  fields      TEXT NOT NULL DEFAULT '[]',
  color       TEXT,
  icon        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT
);

CREATE TABLE entity (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  slug        TEXT NOT NULL,
  namespace   TEXT NOT NULL DEFAULT 'default',
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner       TEXT,
  lifecycle   TEXT,
  tags        TEXT NOT NULL DEFAULT '[]',
  links       TEXT NOT NULL DEFAULT '[]',
  schema_id   TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, schema_id, namespace, slug),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE RESTRICT
);

CREATE INDEX entity_workspace_schema_id_idx ON entity(workspace, schema_id);
CREATE INDEX entity_workspace_owner_idx ON entity(workspace, owner);
CREATE INDEX entity_workspace_lifecycle_idx ON entity(workspace, lifecycle);
CREATE INDEX entity_workspace_name_idx ON entity(workspace, name);

CREATE TABLE project (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pinned', 'active', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT
);

CREATE TABLE project_file (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  path        TEXT NOT NULL,
  name        TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, project_id, path),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE
);

CREATE INDEX project_file_project_idx ON project_file(workspace, project_id);

CREATE TABLE audit_log (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('workspace', 'entity_schema', 'entity', 'project', 'project_file')),
  entity_id       TEXT NOT NULL,
  entity_name     TEXT NOT NULL,
  entity_slug     TEXT,
  schema_id       TEXT,
  changes         TEXT NOT NULL DEFAULT '{}',
  metadata        TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX audit_log_workspace_timestamp_idx ON audit_log(workspace, timestamp DESC);

