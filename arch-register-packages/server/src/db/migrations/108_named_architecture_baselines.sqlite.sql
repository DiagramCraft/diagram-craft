-- Durable point-in-time architecture catalog snapshots. Baseline records deliberately do not
-- reference catalog_record rows: deleting a live entity or relation must not remove evidence.
CREATE TABLE architecture_baseline (
  id                      TEXT PRIMARY KEY,
  workspace               TEXT NOT NULL,
  name                    TEXT NOT NULL,
  description             TEXT,
  owner_team_id           TEXT,
  created_by              TEXT,
  effective_at            TEXT NOT NULL,
  scope_json              TEXT NOT NULL,
  query_json              TEXT,
  include_planned_changes INTEGER NOT NULL CHECK (include_planned_changes IN (0, 1)),
  include_overdue_changes INTEGER NOT NULL CHECK (include_overdue_changes IN (0, 1)),
  superseded_by_id        TEXT,
  deleted_at              TEXT,
  deleted_by              TEXT,
  created_at              TEXT NOT NULL,
  entity_count            INTEGER NOT NULL DEFAULT 0,
  relation_count          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX architecture_baseline_workspace_idx
  ON architecture_baseline(workspace, deleted_at, effective_at DESC, created_at DESC);

CREATE TABLE architecture_baseline_record (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  baseline_id TEXT NOT NULL,
  record_kind TEXT NOT NULL CHECK (record_kind IN ('entity', 'relation')),
  record_id   TEXT NOT NULL,
  state_json  TEXT NOT NULL,
  schema_json TEXT,
  state_hash  TEXT NOT NULL,
  position    INTEGER NOT NULL,
  UNIQUE (workspace, baseline_id, record_kind, record_id)
);

CREATE INDEX architecture_baseline_record_lookup_idx
  ON architecture_baseline_record(workspace, baseline_id, record_kind, position, record_id);

CREATE TABLE architecture_baseline_link (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  baseline_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('project', 'milestone', 'planned_change', 'document', 'governance_case')),
  target_id   TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (workspace, baseline_id, target_type, target_id)
);

CREATE INDEX architecture_baseline_link_target_idx
  ON architecture_baseline_link(workspace, target_type, target_id);
