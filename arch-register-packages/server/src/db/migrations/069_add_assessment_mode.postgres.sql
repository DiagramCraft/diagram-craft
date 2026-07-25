ALTER TABLE assessment
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'fields';

ALTER TABLE assessment DROP CONSTRAINT IF EXISTS assessment_mode_check;
ALTER TABLE assessment ADD CONSTRAINT assessment_mode_check
  CHECK (mode IN ('fields', 'confirm'));
