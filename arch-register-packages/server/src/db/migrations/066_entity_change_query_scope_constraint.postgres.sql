-- Remove the legacy milestone/effective-date exclusivity check for databases
-- that already applied migration 065 before the constraint name was corrected.

ALTER TABLE entity_change_case
  DROP CONSTRAINT IF EXISTS entity_change_case_check;

ALTER TABLE entity_change_case
  DROP CONSTRAINT IF EXISTS entity_change_case_effective_date_milestone_id_check;
