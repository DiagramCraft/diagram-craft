ALTER TABLE assessment
  ADD COLUMN IF NOT EXISTS recurrence JSONB NOT NULL DEFAULT '{"type":"none"}';

ALTER TABLE assessment
  ADD COLUMN IF NOT EXISTS response_window_days INTEGER;

ALTER TABLE assessment
  ADD COLUMN IF NOT EXISTS current_occurrence INTEGER NOT NULL DEFAULT 1;

ALTER TABLE assessment
  ADD COLUMN IF NOT EXISTS pending_occurrence_job_run_id UUID;

ALTER TABLE assessment
  ADD COLUMN IF NOT EXISTS next_occurrence_at TIMESTAMPTZ;

ALTER TABLE assessment_response
  ADD COLUMN IF NOT EXISTS occurrence INTEGER NOT NULL DEFAULT 1;

ALTER TABLE assessment_response
  DROP CONSTRAINT IF EXISTS assessment_response_workspace_assessment_id_entity_id_key;

ALTER TABLE assessment_response
  ADD CONSTRAINT assessment_response_workspace_assessment_id_entity_id_occurrence_key
  UNIQUE (workspace, assessment_id, entity_id, occurrence);
