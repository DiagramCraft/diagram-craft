-- @creates job_workspace_lease
-- @creates job_run
-- @creates job_schedule
CREATE TABLE IF NOT EXISTS job_schedule (
  id                  TEXT PRIMARY KEY,
  workspace           TEXT NOT NULL,
  job_type            TEXT NOT NULL,
  system_identity     TEXT NOT NULL,
  payload             TEXT NOT NULL DEFAULT '{}',
  priority            INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 10),
  recurrence          TEXT NOT NULL,
  enabled             INTEGER NOT NULL DEFAULT 1,
  next_occurrence_at  TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS job_schedule_due_idx
  ON job_schedule(enabled, next_occurrence_at);
CREATE INDEX IF NOT EXISTS job_schedule_workspace_idx
  ON job_schedule(workspace, enabled, next_occurrence_at);

CREATE TABLE IF NOT EXISTS job_run (
  id                    TEXT PRIMARY KEY,
  schedule_id           TEXT NOT NULL,
  workspace             TEXT NOT NULL,
  job_type              TEXT NOT NULL,
  system_identity       TEXT NOT NULL,
  payload               TEXT NOT NULL DEFAULT '{}',
  priority              INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 10),
  occurrence_at         TEXT NOT NULL,
  coalesced_through_at  TEXT NOT NULL,
  coalesced_count       INTEGER NOT NULL CHECK (coalesced_count > 0),
  planned_at            TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at            TEXT,
  completed_at          TEXT,
  worker_id             TEXT,
  lease_token           TEXT,
  result                TEXT,
  error                 TEXT,
  UNIQUE (schedule_id, occurrence_at),
  FOREIGN KEY (schedule_id) REFERENCES job_schedule(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS job_run_queue_idx
  ON job_run(status, priority, planned_at, created_at);
CREATE INDEX IF NOT EXISTS job_run_workspace_status_idx
  ON job_run(workspace, status, planned_at);
CREATE INDEX IF NOT EXISTS job_run_schedule_idx
  ON job_run(schedule_id, occurrence_at);

CREATE TABLE IF NOT EXISTS job_workspace_lease (
  workspace       TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  worker_id       TEXT NOT NULL,
  lease_token     TEXT NOT NULL,
  acquired_at     TEXT NOT NULL,
  heartbeat_at    TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES job_run(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS job_workspace_lease_expiry_idx
  ON job_workspace_lease(expires_at);
