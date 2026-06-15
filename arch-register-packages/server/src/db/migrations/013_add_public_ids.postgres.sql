-- @creates public_id_prefix
CREATE TABLE public_id_prefix (
  prefix       TEXT PRIMARY KEY,
  owner_type   TEXT NOT NULL CHECK (owner_type IN ('workspace', 'schema')),
  owner_id     UUID NOT NULL,
  next_number  INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (owner_type, owner_id)
);

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
  ELSE substring(upper(regexp_replace(name, '\s+', '', 'g')) from 1 for 5)
END
WHERE key_prefix IS NULL;
ALTER TABLE entity_schema ALTER COLUMN key_prefix SET NOT NULL;
ALTER TABLE entity_schema ADD CONSTRAINT entity_schema_key_prefix_unique UNIQUE (key_prefix);

ALTER TABLE entity ADD COLUMN public_id TEXT;
UPDATE entity SET public_id = id::text WHERE public_id IS NULL;
ALTER TABLE entity ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE entity ADD CONSTRAINT entity_public_id_unique UNIQUE (public_id);

ALTER TABLE project ADD COLUMN public_id TEXT;
UPDATE project SET public_id = id::text WHERE public_id IS NULL;
ALTER TABLE project ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE project ADD CONSTRAINT project_public_id_unique UNIQUE (public_id);

INSERT INTO public_id_prefix (prefix, owner_type, owner_id, next_number, created_at, updated_at)
SELECT short_code, 'workspace', id, 1, created_at, updated_at
FROM workspace
WHERE short_code ~ '^[A-Z]{2,5}$'
ON CONFLICT DO NOTHING;

INSERT INTO public_id_prefix (prefix, owner_type, owner_id, next_number, created_at, updated_at)
SELECT key_prefix, 'schema', id, 1, created_at, updated_at
FROM entity_schema
ON CONFLICT DO NOTHING;
