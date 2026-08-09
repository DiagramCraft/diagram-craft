ALTER TABLE job_run ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX job_run_workspace_type_dedupe_idx
  ON job_run(workspace, job_type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
