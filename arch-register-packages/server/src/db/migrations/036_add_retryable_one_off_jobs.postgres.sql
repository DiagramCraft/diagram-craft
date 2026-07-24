ALTER TABLE job_run ALTER COLUMN schedule_id DROP NOT NULL;
ALTER TABLE job_run ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);
ALTER TABLE job_run ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts > 0);
