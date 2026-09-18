CREATE TABLE integration_source (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'degraded', 'paused')),
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, source_key)
);

CREATE TABLE integration_sync_run (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES integration_source(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  external_run_id TEXT NOT NULL,
  scope_key TEXT,
  coverage TEXT NOT NULL CHECK (coverage IN ('complete', 'partial')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  counts JSONB NOT NULL,
  warnings JSONB NOT NULL,
  failures JSONB NOT NULL,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, source_id, external_run_id)
);

CREATE TABLE integration_managed_record (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES integration_source(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('entity', 'relation', 'artifact')),
  external_key TEXT NOT NULL,
  record_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('active', 'missing', 'orphaned', 'stale', 'failing')),
  scope_key TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_seen_at TIMESTAMPTZ,
  last_seen_run_id UUID REFERENCES integration_sync_run(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, source_id, record_type, external_key)
);

CREATE INDEX integration_sync_run_workspace_started_idx
  ON integration_sync_run (workspace, started_at DESC);
CREATE INDEX integration_managed_record_workspace_state_idx
  ON integration_managed_record (workspace, state, updated_at DESC);
