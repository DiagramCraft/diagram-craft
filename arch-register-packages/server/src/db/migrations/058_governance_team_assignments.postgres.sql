ALTER TABLE governance_assignment DROP CONSTRAINT IF EXISTS governance_assignment_target_type_check;
ALTER TABLE governance_assignment ADD CONSTRAINT governance_assignment_target_type_check
  CHECK (target_type IN ('user', 'team', 'team_role', 'capability'));
