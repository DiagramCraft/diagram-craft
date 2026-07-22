-- Make future change-case selection deterministic for SQL point-in-time queries.

ALTER TABLE entity_change_case
  DROP CONSTRAINT IF EXISTS entity_change_case_check;

ALTER TABLE entity_change_case
  DROP CONSTRAINT IF EXISTS entity_change_case_effective_date_milestone_id_check;

ALTER TABLE entity_change_case_revision
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE entity_change_case c
SET effective_date = m.target_date
FROM project_milestone m
WHERE c.milestone_id = m.id
  AND c.effective_date IS NULL;

WITH ranked_revisions AS (
  SELECT r.id,
         ROW_NUMBER() OVER (
           PARTITION BY r.case_id
           ORDER BY r.revision_number DESC, r.created_at DESC
         ) AS row_number
  FROM entity_change_case_revision r
  JOIN entity_change_case c ON c.id = r.case_id
  WHERE c.status IN ('planned', 'in_approval')
    AND r.status IN ('draft', 'submitted', 'changes_requested')
)
UPDATE entity_change_case_revision r
SET is_active = TRUE
FROM ranked_revisions ranked
WHERE r.id = ranked.id
  AND ranked.row_number = 1;

CREATE UNIQUE INDEX entity_change_case_revision_active_idx
  ON entity_change_case_revision(case_id)
  WHERE is_active;

CREATE INDEX entity_change_case_effective_date_idx
  ON entity_change_case(workspace, effective_date)
  WHERE effective_date IS NOT NULL;

CREATE INDEX entity_version_entity_time_idx
  ON entity_version(workspace, entity_id, created_at DESC, version_number DESC);
