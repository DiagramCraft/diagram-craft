ALTER TABLE governance_event DROP CONSTRAINT IF EXISTS governance_event_event_type_check;
ALTER TABLE governance_event ADD CONSTRAINT governance_event_event_type_check
  CHECK (event_type IN (
    'submitted', 'assigned', 'reassigned', 'changes_requested', 'resubmitted',
    'approved', 'rejected', 'acknowledged', 'cancelled', 'admin_override',
    'proposal_stale', 'domain_effect_applied', 'domain_effect_failed',
    'scope_refreshed', 'postponed', 'finalized', 'finalization_override'
  ));
