-- Enable uuid generation (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Entity schema table: defines the "type" of an entity (Component, System, Domain, etc.)
CREATE TABLE entity_schema (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  fields      JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity table: instances of a schema type
CREATE TABLE entity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL,
  namespace   TEXT        NOT NULL DEFAULT 'default',
  name        TEXT        NOT NULL,
  owner       TEXT,
  lifecycle   TEXT        CHECK (lifecycle IN ('experimental', 'production', 'deprecated')),
  schema_id   UUID        NOT NULL REFERENCES entity_schema(id) ON DELETE RESTRICT,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schema_id, namespace, slug)
);

-- Index for filtering entities by schema type
CREATE INDEX entity_schema_id_idx ON entity(schema_id);

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

CREATE TRIGGER entity_updated_at
  BEFORE UPDATE ON entity
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
