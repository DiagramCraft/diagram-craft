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
--
-- SQLite requires a full table rebuild to add CHECK constraints or drop a FOREIGN KEY, so
-- this follows the same rebuild pattern used elsewhere in this migration history (e.g.
-- 061_drop_entity_grant_viewer_role): rename first (auto-updates FK references in the
-- ~13 dependent tables), then rebuild in place.

PRAGMA foreign_keys = OFF;

ALTER TABLE entity RENAME TO catalog_record;

CREATE TABLE catalog_record_new (
  id                        TEXT PRIMARY KEY,
  workspace                 TEXT NOT NULL,
  kind                      TEXT NOT NULL CHECK (kind IN ('entity', 'relation')),
  public_id                 TEXT,
  slug                      TEXT,
  namespace                 TEXT,
  name                      TEXT,
  description               TEXT NOT NULL DEFAULT '',
  owner                     TEXT,
  lifecycle                 TEXT,
  target_lifecycle          TEXT,
  target_lifecycle_date     TEXT,
  tags                      TEXT NOT NULL DEFAULT '[]',
  links                     TEXT NOT NULL DEFAULT '[]',
  schema_id                 TEXT NOT NULL,
  data                      TEXT NOT NULL DEFAULT '{}',
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  deleted_at                DATETIME,
  version                   INTEGER NOT NULL DEFAULT 1,
  approval_policy_override  TEXT CHECK (approval_policy_override IN ('required', 'disabled')),
  generated_metadata        TEXT NOT NULL DEFAULT '{}',
  project_id                TEXT,
  completeness              INTEGER NOT NULL DEFAULT 0,
  last_attested_at          TEXT,
  in_record_id              TEXT,
  out_record_id             TEXT,
  UNIQUE (public_id),
  UNIQUE (workspace, schema_id, namespace, slug),
  UNIQUE (workspace, id),
  CHECK (kind <> 'entity' OR (slug IS NOT NULL AND namespace IS NOT NULL AND name IS NOT NULL AND public_id IS NOT NULL)),
  CHECK (kind <> 'relation' OR (slug IS NULL AND namespace IS NULL AND name IS NULL)),
  CHECK (kind <> 'relation' OR (in_record_id IS NOT NULL AND out_record_id IS NOT NULL AND in_record_id <> out_record_id)),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, target_lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, in_record_id) REFERENCES catalog_record(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, out_record_id) REFERENCES catalog_record(workspace, id) ON DELETE CASCADE
);

INSERT INTO catalog_record_new (
  id, workspace, kind, public_id, slug, namespace, name, description, owner, lifecycle,
  target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, created_at, updated_at,
  deleted_at, version, approval_policy_override, generated_metadata, project_id, completeness,
  last_attested_at, in_record_id, out_record_id
)
SELECT
  id, workspace, 'entity', public_id, slug, namespace, name, description, owner, lifecycle,
  target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, created_at, updated_at,
  deleted_at, version, approval_policy_override, generated_metadata, project_id, completeness,
  last_attested_at, NULL, NULL
FROM catalog_record;

INSERT INTO catalog_record_new (
  id, workspace, kind, description, schema_id, data, created_at, updated_at,
  version, approval_policy_override, in_record_id, out_record_id
)
SELECT
  id, workspace, 'relation', '', schema_id, data, created_at, updated_at,
  version, approval_policy_override, in_entity_id, out_entity_id
FROM relation;

DROP TABLE catalog_record;
DROP TABLE relation;
ALTER TABLE catalog_record_new RENAME TO catalog_record;

CREATE INDEX catalog_record_workspace_schema_id_idx ON catalog_record(workspace, schema_id);
CREATE INDEX catalog_record_workspace_owner_idx ON catalog_record(workspace, owner);
CREATE INDEX catalog_record_workspace_lifecycle_idx ON catalog_record(workspace, lifecycle);
CREATE INDEX catalog_record_workspace_target_lifecycle_idx ON catalog_record(workspace, target_lifecycle);
CREATE INDEX catalog_record_workspace_name_idx ON catalog_record(workspace, name);
CREATE INDEX catalog_record_workspace_project_id_idx ON catalog_record(workspace, project_id);
CREATE INDEX catalog_record_workspace_in_record_idx ON catalog_record(workspace, in_record_id);
CREATE INDEX catalog_record_workspace_out_record_idx ON catalog_record(workspace, out_record_id);

-- record_version (renamed from entity_version): now keyed on any catalog_record, not just entities.
ALTER TABLE entity_version RENAME TO record_version;
ALTER TABLE record_version RENAME COLUMN entity_id TO record_id;
-- Entity and relation schema versions live in separate tables, so this polymorphic reference
-- is validated by the catalog write paths using the record state's schema_id.
ALTER TABLE record_version ADD COLUMN schema_version_id TEXT;

CREATE INDEX record_version_schema_version_idx
  ON record_version(workspace, schema_version_id)
  WHERE schema_version_id IS NOT NULL;

-- record_change_case_record_version (renamed from entity_change_case_entity_version).
ALTER TABLE entity_change_case_entity_version RENAME TO record_change_case_record_version;
ALTER TABLE record_change_case_record_version RENAME COLUMN entity_id TO record_id;

-- governance_case.subject_type already accepts any TEXT value; relation subjects can use
-- subject_type = 'relation' without a schema change.

PRAGMA foreign_keys = ON;
