-- #2686: unify entity and relation instances into a single catalog_record table with a
-- `kind` discriminator, so relation instances can share entity's identity/version/
-- change-case/governance infrastructure (#2687) instead of growing a parallel copy.
--
-- Invariants:
--   * kind = 'entity'   -> slug, namespace, name, public_id are required; in_record_id/
--                          out_record_id are NULL.
--   * kind = 'relation' -> in_record_id, out_record_id are required and distinct;
--                          slug, namespace, name are NULL (relations have no identity
--                          fields of their own today).
--   * schema_id resolves against entity_schema for kind='entity' and relation_schema for
--     kind='relation'. A single FK can't express that disjunction, so the schema_id FK to
--     entity_schema is dropped here; schema integrity for both kinds is enforced at the
--     application layer (see relationSchemaHelpers.ts / entity schema validation).
--   * This is a pre-release schema change (no production data) — relation rows are
--     migrated in place rather than left as a parallel table.

ALTER TABLE entity RENAME TO catalog_record;

ALTER TABLE catalog_record ADD COLUMN kind TEXT NOT NULL DEFAULT 'entity';
ALTER TABLE catalog_record ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE catalog_record ADD CONSTRAINT catalog_record_kind_check CHECK (kind IN ('entity', 'relation'));

ALTER TABLE catalog_record ALTER COLUMN slug DROP NOT NULL;
ALTER TABLE catalog_record ALTER COLUMN namespace DROP NOT NULL;
ALTER TABLE catalog_record ALTER COLUMN namespace DROP DEFAULT;
ALTER TABLE catalog_record ALTER COLUMN name DROP NOT NULL;
ALTER TABLE catalog_record ALTER COLUMN public_id DROP NOT NULL;

ALTER TABLE catalog_record DROP CONSTRAINT entity_workspace_schema_id_fkey;

ALTER TABLE catalog_record ADD COLUMN in_record_id UUID;
ALTER TABLE catalog_record ADD COLUMN out_record_id UUID;

ALTER TABLE catalog_record
  ADD CONSTRAINT catalog_record_entity_identity_check
    CHECK (kind <> 'entity' OR (slug IS NOT NULL AND namespace IS NOT NULL AND name IS NOT NULL AND public_id IS NOT NULL)),
  ADD CONSTRAINT catalog_record_relation_no_identity_check
    CHECK (kind <> 'relation' OR (slug IS NULL AND namespace IS NULL AND name IS NULL)),
  ADD CONSTRAINT catalog_record_relation_endpoints_check
    CHECK (kind <> 'relation' OR (in_record_id IS NOT NULL AND out_record_id IS NOT NULL AND in_record_id <> out_record_id));

ALTER TABLE catalog_record
  ADD CONSTRAINT catalog_record_workspace_in_record_id_fkey
    FOREIGN KEY (workspace, in_record_id) REFERENCES catalog_record(workspace, id) ON DELETE CASCADE,
  ADD CONSTRAINT catalog_record_workspace_out_record_id_fkey
    FOREIGN KEY (workspace, out_record_id) REFERENCES catalog_record(workspace, id) ON DELETE CASCADE;

CREATE INDEX catalog_record_workspace_in_record_idx ON catalog_record(workspace, in_record_id) WHERE in_record_id IS NOT NULL;
CREATE INDEX catalog_record_workspace_out_record_idx ON catalog_record(workspace, out_record_id) WHERE out_record_id IS NOT NULL;

INSERT INTO catalog_record (
  id, workspace, kind, description, schema_id, data, created_at, updated_at,
  version, approval_policy_override, in_record_id, out_record_id,
  tags, links, generated_metadata, completeness
)
SELECT
  id, workspace, 'relation', '', schema_id, data, created_at, updated_at,
  version, approval_policy_override, in_entity_id, out_entity_id,
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, 0
FROM relation;

DROP TABLE relation;

-- record_version (renamed from entity_version): now keyed on any catalog_record, not just entities.
ALTER TABLE entity_version RENAME TO record_version;
ALTER TABLE record_version RENAME COLUMN entity_id TO record_id;
-- Entity and relation schema versions live in separate tables, so this polymorphic reference
-- is validated by the catalog write paths using the record state's schema_id.
ALTER TABLE record_version ADD COLUMN schema_version_id UUID;

CREATE INDEX record_version_schema_version_idx
  ON record_version(workspace, schema_version_id)
  WHERE schema_version_id IS NOT NULL;

-- record_change_case_record_version (renamed from entity_change_case_entity_version).
ALTER TABLE entity_change_case_entity_version RENAME TO record_change_case_record_version;
ALTER TABLE record_change_case_record_version RENAME COLUMN entity_id TO record_id;

-- governance_case.subject_type already accepts any TEXT value; relation subjects can use
-- subject_type = 'relation' without a schema change.
