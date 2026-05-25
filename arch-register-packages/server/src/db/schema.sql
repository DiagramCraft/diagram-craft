-- Enable uuid generation (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE workspace (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity schema table: defines the "type" of an entity (Component, System, Domain, etc.)
CREATE TABLE entity_schema (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  fields      JSONB       NOT NULL DEFAULT '[]',
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
  owner       TEXT,
  lifecycle   TEXT        CHECK (lifecycle IN ('experimental', 'production', 'deprecated')),
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
