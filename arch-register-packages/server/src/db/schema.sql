-- Enable uuid generation (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE workspace (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  url_slug    TEXT        NOT NULL UNIQUE,
  short_code  TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity schema table: defines the "type" of an entity (Component, System, Domain, etc.)
CREATE TABLE entity_schema (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  fields      JSONB       NOT NULL DEFAULT '[]',
  color       TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT
);

-- Entity table: instances of a schema type
CREATE TABLE entity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace   TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  namespace   TEXT        NOT NULL DEFAULT 'default',
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  owner       TEXT,
  lifecycle   TEXT        CHECK (lifecycle IN ('proposed', 'experimental', 'production', 'deprecated')),
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  links       JSONB       NOT NULL DEFAULT '[]',
  schema_id   UUID        NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, schema_id, namespace, slug),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE RESTRICT
);

-- Index for filtering entities by schema type
CREATE INDEX entity_workspace_schema_id_idx ON entity(workspace, schema_id);
CREATE INDEX entity_workspace_owner_idx ON entity(workspace, owner);
CREATE INDEX entity_workspace_lifecycle_idx ON entity(workspace, lifecycle);
CREATE INDEX entity_workspace_name_idx ON entity(workspace, name);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entity_schema_updated_at
  BEFORE UPDATE ON entity_schema
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workspace_updated_at
  BEFORE UPDATE ON workspace
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER entity_updated_at
  BEFORE UPDATE ON entity
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Project table: groups diagram files within a workspace
CREATE TABLE project (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('pinned', 'active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT
);

-- Project file table: diagram files within a project, organized by path
CREATE TABLE project_file (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace   TEXT        NOT NULL,
  project_id  UUID        NOT NULL,
  path        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  size_bytes  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace, project_id, path),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE
);

CREATE INDEX project_file_project_idx ON project_file(workspace, project_id);

CREATE TRIGGER project_updated_at
  BEFORE UPDATE ON project
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER project_file_updated_at
  BEFORE UPDATE ON project_file
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit log table: tracks all mutations with field-level changes
CREATE TABLE audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace       TEXT        NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         TEXT        NOT NULL,
  operation       TEXT        NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type     TEXT        NOT NULL CHECK (entity_type IN ('workspace', 'entity_schema', 'entity', 'project', 'project_file')),
  entity_id       TEXT        NOT NULL,
  entity_name     TEXT        NOT NULL,
  entity_slug     TEXT,
  schema_id       UUID,
  changes         JSONB       NOT NULL DEFAULT '{}',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX audit_log_workspace_timestamp_idx ON audit_log(workspace, timestamp DESC);
CREATE INDEX audit_log_workspace_entity_type_idx ON audit_log(workspace, entity_type);
CREATE INDEX audit_log_workspace_entity_id_idx ON audit_log(workspace, entity_id);
CREATE INDEX audit_log_workspace_user_idx ON audit_log(workspace, user_id);
CREATE INDEX audit_log_workspace_operation_idx ON audit_log(workspace, operation);
CREATE INDEX audit_log_timestamp_idx ON audit_log(timestamp DESC);
CREATE INDEX audit_log_changes_gin_idx ON audit_log USING GIN (changes);
