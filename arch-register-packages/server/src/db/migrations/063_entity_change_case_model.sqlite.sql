-- Target domain model for actual entity history and coordinated entity changes.

-- @creates entity_change_case
CREATE TABLE entity_change_case (
  id                 TEXT PRIMARY KEY,
  workspace          TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  project_id         TEXT REFERENCES project(id) ON DELETE SET NULL,
  status             TEXT NOT NULL CHECK (status IN ('planned', 'in_approval', 'applied', 'rejected', 'withdrawn', 'cancelled', 'superseded')),
  purpose            TEXT NOT NULL DEFAULT 'planned_change' CHECK (purpose IN ('planned_change', 'requested_change')),
  name               TEXT,
  description        TEXT,
  effective_date     TEXT,
  milestone_id       TEXT REFERENCES project_milestone(id) ON DELETE SET NULL,
  initiator_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  closed_at          TEXT,
  CHECK (NOT (effective_date IS NOT NULL AND milestone_id IS NOT NULL))
);

CREATE INDEX entity_change_case_workspace_status_idx ON entity_change_case(workspace, status, updated_at DESC);
CREATE INDEX entity_change_case_project_idx ON entity_change_case(project_id) WHERE project_id IS NOT NULL;

-- @creates entity_change_case_revision
CREATE TABLE entity_change_case_revision (
  id                 TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES entity_change_case(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  revision_number    INTEGER NOT NULL,
  policy_version     TEXT,
  resolved_policy    TEXT NOT NULL DEFAULT '{}',
  message            TEXT,
  created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  status             TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'changes_requested', 'stale', 'applied', 'rejected', 'withdrawn', 'superseded')),
  created_at         TEXT NOT NULL,
  resolved_at        TEXT,
  UNIQUE (case_id, revision_number)
);

CREATE INDEX entity_change_case_revision_case_idx ON entity_change_case_revision(case_id, revision_number DESC);

-- @creates entity_version
CREATE TABLE entity_version (
  id                       TEXT PRIMARY KEY,
  workspace                TEXT NOT NULL,
  entity_id                TEXT NOT NULL,
  version_number           INTEGER NOT NULL,
  kind                     TEXT NOT NULL CHECK (kind IN ('autosave', 'saved_version', 'deleted', 'restored', 'direct_edit', 'case_applied', 'bypass')),
  commit_message           TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  created_by               TEXT REFERENCES users(id) ON DELETE SET NULL,
  state                    TEXT NOT NULL,
  applied_case_revision_id TEXT REFERENCES entity_change_case_revision(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  UNIQUE (workspace, entity_id, version_number)
);

CREATE INDEX entity_version_entity_idx ON entity_version(workspace, entity_id, created_at DESC);
CREATE INDEX entity_version_case_revision_idx ON entity_version(applied_case_revision_id)
  WHERE applied_case_revision_id IS NOT NULL;

-- @creates entity_change_case_entity_version
CREATE TABLE entity_change_case_entity_version (
  id                 TEXT PRIMARY KEY,
  revision_id        TEXT NOT NULL REFERENCES entity_change_case_revision(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  entity_id          TEXT NOT NULL,
  base_version       INTEGER NOT NULL,
  base_state         TEXT NOT NULL,
  proposed_state     TEXT NOT NULL,
  diff               TEXT NOT NULL,
  applied_version_id TEXT REFERENCES entity_version(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  UNIQUE (revision_id, entity_id)
);

CREATE INDEX entity_change_case_entity_version_entity_idx ON entity_change_case_entity_version(workspace, entity_id);
CREATE INDEX entity_change_case_entity_version_revision_idx ON entity_change_case_entity_version(revision_id);
