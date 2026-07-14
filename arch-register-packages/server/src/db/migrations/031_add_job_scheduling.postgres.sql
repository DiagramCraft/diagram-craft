-- @creates job_workspace_lease
-- @creates job_run
-- @creates job_schedule
CREATE TABLE IF NOT EXISTS job_schedule (
  id                  UUID PRIMARY KEY,
  workspace           UUID NOT NULL,
  job_type            TEXT NOT NULL,
  system_identity     TEXT NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  priority            SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 10),
  recurrence          JSONB NOT NULL,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  next_occurrence_at  TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS job_schedule_due_idx
  ON job_schedule(enabled, next_occurrence_at);
CREATE INDEX IF NOT EXISTS job_schedule_workspace_idx
  ON job_schedule(workspace, enabled, next_occurrence_at);

CREATE TABLE IF NOT EXISTS job_run (
  id                    UUID PRIMARY KEY,
  schedule_id           UUID NOT NULL,
  workspace             UUID NOT NULL,
  job_type              TEXT NOT NULL,
  system_identity       TEXT NOT NULL,
  payload               JSONB NOT NULL DEFAULT '{}',
  priority              SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 10),
  occurrence_at         TIMESTAMPTZ NOT NULL,
  coalesced_through_at  TIMESTAMPTZ NOT NULL,
  coalesced_count       INTEGER NOT NULL CHECK (coalesced_count > 0),
  planned_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  worker_id             TEXT,
  lease_token           UUID,
  result                JSONB,
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
  workspace       UUID PRIMARY KEY,
  run_id          UUID NOT NULL,
  worker_id       TEXT NOT NULL,
  lease_token     UUID NOT NULL,
  acquired_at     TIMESTAMPTZ NOT NULL,
  heartbeat_at    TIMESTAMPTZ NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES job_run(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS job_workspace_lease_expiry_idx
  ON job_workspace_lease(expires_at);
