-- Make future change-case selection deterministic for SQL point-in-time queries.

PRAGMA foreign_keys = OFF;

CREATE TABLE entity_change_case_new (
  id                 TEXT PRIMARY KEY,
  workspace          TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  project_id         TEXT REFERENCES project(id) ON DELETE SET NULL,
  status             TEXT NOT NULL CHECK (status IN ('planned', 'in_approval', 'applied', 'rejected', 'withdrawn', 'cancelled', 'superseded')),
  purpose            TEXT NOT NULL DEFAULT 'planned_change' CHECK (purpose IN ('planned_change', 'requested_change')),
  name               TEXT,
  description        TEXT,
  effective_date     TEXT,
  milestone_id       TEXT REFERENCES project_milestone(id) ON DELETE SET NULL,
  initiator_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  closed_at          TEXT
);

INSERT INTO entity_change_case_new
  (id, workspace, project_id, status, purpose, name, description, effective_date, milestone_id,
   initiator_user_id, created_at, updated_at, closed_at)
SELECT id, workspace, project_id, status, purpose, name, description, effective_date, milestone_id,
       initiator_user_id, created_at, updated_at, closed_at
FROM entity_change_case;

DROP TABLE entity_change_case;
ALTER TABLE entity_change_case_new RENAME TO entity_change_case;

CREATE INDEX entity_change_case_workspace_status_idx
  ON entity_change_case(workspace, status, updated_at DESC);
CREATE INDEX entity_change_case_project_idx
  ON entity_change_case(project_id)
  WHERE project_id IS NOT NULL;

ALTER TABLE entity_change_case_revision
  ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;

UPDATE entity_change_case
SET effective_date = (
  SELECT m.target_date
  FROM project_milestone m
  WHERE m.id = entity_change_case.milestone_id
)
WHERE milestone_id IS NOT NULL
  AND effective_date IS NULL;

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
UPDATE entity_change_case_revision
SET is_active = 1
WHERE id IN (SELECT id FROM ranked_revisions WHERE row_number = 1);

CREATE UNIQUE INDEX entity_change_case_revision_active_idx
  ON entity_change_case_revision(case_id)
  WHERE is_active = 1;

CREATE INDEX entity_change_case_effective_date_idx
  ON entity_change_case(workspace, effective_date)
  WHERE effective_date IS NOT NULL;

CREATE INDEX entity_version_entity_time_idx
  ON entity_version(workspace, entity_id, created_at DESC, version_number DESC);

PRAGMA foreign_keys = ON;
