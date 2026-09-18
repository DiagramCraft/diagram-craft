CREATE TABLE integration_source (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'degraded', 'paused')),
  last_success_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, source_key)
);

CREATE TABLE integration_sync_run (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES integration_source(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  external_run_id TEXT NOT NULL,
  scope_key TEXT,
  coverage TEXT NOT NULL CHECK (coverage IN ('complete', 'partial')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  counts TEXT NOT NULL,
  warnings TEXT NOT NULL,
  failures TEXT NOT NULL,
  provenance TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, source_id, external_run_id)
);

CREATE TABLE integration_managed_record (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES integration_source(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('entity', 'relation', 'artifact')),
  external_key TEXT NOT NULL,
  record_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('active', 'missing', 'orphaned', 'stale', 'failing')),
  scope_key TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_seen_at TEXT,
  last_seen_run_id TEXT REFERENCES integration_sync_run(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, source_id, record_type, external_key)
);

CREATE INDEX integration_sync_run_workspace_started_idx
  ON integration_sync_run (workspace, started_at DESC);
CREATE INDEX integration_managed_record_workspace_state_idx
  ON integration_managed_record (workspace, state, updated_at DESC);
