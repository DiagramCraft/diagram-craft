ALTER TABLE assessment DROP CONSTRAINT IF EXISTS assessment_status_check;
ALTER TABLE assessment ADD CONSTRAINT assessment_status_check
  CHECK (status IN ('active', 'archived', 'draft', 'open', 'closed'));

UPDATE assessment SET status = 'open' WHERE status = 'active';

ALTER TABLE assessment DROP CONSTRAINT IF EXISTS assessment_status_check;
ALTER TABLE assessment ADD CONSTRAINT assessment_status_check
  CHECK (status IN ('draft', 'open', 'closed', 'archived'));

ALTER TABLE assessment ALTER COLUMN status SET DEFAULT 'draft';
