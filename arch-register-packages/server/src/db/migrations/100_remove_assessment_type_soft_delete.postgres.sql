-- Assessment types now follow lifecycle-state replacement semantics: omitted rows are deleted.
-- Clear legacy inactive and dangling references before enforcing the workspace-scoped FK.
UPDATE assessment AS a
SET assessment_type_id = NULL
WHERE a.assessment_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_assessment_type AS t
    WHERE t.workspace = a.workspace
      AND t.id = a.assessment_type_id
      AND t.is_active
  );

DELETE FROM workspace_assessment_type
WHERE NOT is_active;

ALTER TABLE workspace_assessment_type
  DROP COLUMN is_active;

ALTER TABLE workspace_assessment_type
  ADD CONSTRAINT workspace_assessment_type_workspace_id_key UNIQUE (workspace, id);

ALTER TABLE assessment
  ADD CONSTRAINT assessment_workspace_assessment_type_fk
  FOREIGN KEY (workspace, assessment_type_id)
  REFERENCES workspace_assessment_type(workspace, id)
  ON DELETE SET NULL;
