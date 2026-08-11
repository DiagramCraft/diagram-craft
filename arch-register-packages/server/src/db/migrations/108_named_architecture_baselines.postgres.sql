-- Durable point-in-time architecture catalog snapshots. Baseline records deliberately do not
-- reference catalog_record rows: deleting a live entity or relation must not remove evidence.
CREATE TABLE architecture_baseline (
  id                      TEXT PRIMARY KEY,
  workspace               TEXT NOT NULL,
  name                    TEXT NOT NULL,
  description             TEXT,
  owner_team_id           TEXT,
  created_by              TEXT,
  effective_at            TIMESTAMPTZ NOT NULL,
  scope_json              JSONB NOT NULL,
  query_json              JSONB,
  include_planned_changes BOOLEAN NOT NULL,
  include_overdue_changes BOOLEAN NOT NULL,
  superseded_by_id        TEXT,
  deleted_at              TIMESTAMPTZ,
  deleted_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL,
  entity_count            INTEGER NOT NULL DEFAULT 0,
  relation_count          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX architecture_baseline_workspace_idx
  ON architecture_baseline(workspace, deleted_at, effective_at DESC, created_at DESC);

CREATE TABLE architecture_baseline_record (
  id                TEXT PRIMARY KEY,
  workspace         TEXT NOT NULL,
  baseline_id       TEXT NOT NULL,
  record_kind       TEXT NOT NULL CHECK (record_kind IN ('entity', 'relation')),
  record_id         TEXT NOT NULL,
  record_version_id UUID REFERENCES record_version(id) ON DELETE RESTRICT,
  -- Only used for a projected planned-change state or a record without history.
  state_json        JSONB,
  state_hash        TEXT NOT NULL,
  position          INTEGER NOT NULL,
  UNIQUE (workspace, baseline_id, record_kind, record_id)
);

CREATE INDEX architecture_baseline_record_lookup_idx
  ON architecture_baseline_record(workspace, baseline_id, record_kind, position, record_id);

CREATE INDEX architecture_baseline_record_version_idx
  ON architecture_baseline_record(workspace, record_version_id)
  WHERE record_version_id IS NOT NULL;

CREATE TABLE architecture_baseline_link (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  baseline_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('project', 'milestone', 'planned_change', 'document', 'governance_case')),
  target_id   TEXT NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, baseline_id, target_type, target_id)
);

CREATE INDEX architecture_baseline_link_target_idx
  ON architecture_baseline_link(workspace, target_type, target_id);
