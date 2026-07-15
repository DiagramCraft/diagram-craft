ALTER TABLE job_workspace_lease RENAME TO job_workspace_lease_old;
ALTER TABLE job_run RENAME TO job_run_old;

CREATE TABLE job_run (
  id                    TEXT PRIMARY KEY,
  schedule_id           TEXT,
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
  attempt_count         INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts          INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
  UNIQUE (schedule_id, occurrence_at),
  FOREIGN KEY (schedule_id) REFERENCES job_schedule(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

INSERT INTO job_run (
  id, schedule_id, workspace, job_type, system_identity, payload, priority,
  occurrence_at, coalesced_through_at, coalesced_count, planned_at, created_at,
  status, started_at, completed_at, worker_id, lease_token, result, error
)
SELECT id, schedule_id, workspace, job_type, system_identity, payload, priority,
       occurrence_at, coalesced_through_at, coalesced_count, planned_at, created_at,
       status, started_at, completed_at, worker_id, lease_token, result, error
FROM job_run_old;

CREATE TABLE job_workspace_lease (
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

INSERT INTO job_workspace_lease
SELECT * FROM job_workspace_lease_old;

DROP TABLE job_workspace_lease_old;
DROP TABLE job_run_old;

CREATE INDEX job_run_queue_idx ON job_run(status, priority, planned_at, created_at);
CREATE INDEX job_run_workspace_status_idx ON job_run(workspace, status, planned_at);
CREATE INDEX job_run_schedule_idx ON job_run(schedule_id, occurrence_at);
CREATE INDEX job_workspace_lease_expiry_idx ON job_workspace_lease(expires_at);
