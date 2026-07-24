CREATE INDEX IF NOT EXISTS job_run_workspace_planned_idx
  ON job_run(workspace, planned_at DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS job_run_workspace_schedule_planned_idx
  ON job_run(workspace, schedule_id, planned_at DESC, created_at DESC, id DESC);
