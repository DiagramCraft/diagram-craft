-- @creates conformance_check
-- @creates conformance_check_revision
-- @creates conformance_evaluation_run
-- @creates conformance_violation
-- @creates conformance_violation_event
-- @creates conformance_exemption
CREATE TABLE IF NOT EXISTS conformance_check (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  severity    TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
  enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  definition  TEXT NOT NULL,
  revision    INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS conformance_check_workspace_idx
  ON conformance_check(workspace, enabled, name);

CREATE TABLE IF NOT EXISTS conformance_check_revision (
  id          TEXT PRIMARY KEY,
  check_id    TEXT NOT NULL,
  revision    INTEGER NOT NULL CHECK (revision > 0),
  definition  TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (check_id, revision),
  FOREIGN KEY (check_id) REFERENCES conformance_check(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conformance_evaluation_run (
  id               TEXT PRIMARY KEY,
  workspace        TEXT NOT NULL,
  check_id         TEXT,
  job_run_id       TEXT,
  status           TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at       TEXT NOT NULL,
  completed_at     TEXT,
  checked_count    INTEGER NOT NULL DEFAULT 0,
  violation_count  INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  configuration    TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (check_id) REFERENCES conformance_check(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS conformance_run_workspace_idx
  ON conformance_evaluation_run(workspace, started_at DESC);

CREATE TABLE IF NOT EXISTS conformance_violation (
  id             TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL,
  check_id       TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  schema_id      TEXT,
  severity       TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
  message        TEXT NOT NULL,
  evidence       TEXT NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL CHECK (status IN ('active', 'acknowledged', 'resolved', 'exempt')),
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  resolved_at    TEXT,
  UNIQUE (workspace, check_id, entity_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (check_id) REFERENCES conformance_check(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES catalog_record(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS conformance_violation_workspace_status_idx
  ON conformance_violation(workspace, status, severity, last_seen_at);
CREATE INDEX IF NOT EXISTS conformance_violation_check_entity_idx
  ON conformance_violation(check_id, entity_id);

CREATE TABLE IF NOT EXISTS conformance_violation_event (
  id             TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL,
  violation_id   TEXT NOT NULL,
  run_id         TEXT,
  event_type     TEXT NOT NULL CHECK (event_type IN ('observed', 'acknowledged', 'resolved', 'exempted')),
  details        TEXT NOT NULL DEFAULT '{}',
  occurred_at    TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (violation_id) REFERENCES conformance_violation(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES conformance_evaluation_run(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS conformance_violation_event_idx
  ON conformance_violation_event(violation_id, occurred_at);

CREATE TABLE IF NOT EXISTS conformance_exemption (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  violation_id TEXT NOT NULL,
  reason      TEXT NOT NULL,
  expires_at  TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  revoked_at  TEXT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (violation_id) REFERENCES conformance_violation(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS conformance_exemption_active_idx
  ON conformance_exemption(violation_id, revoked_at, expires_at);
