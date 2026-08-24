ALTER TABLE conformance_violation_event DROP CONSTRAINT IF EXISTS conformance_violation_event_event_type_check;
ALTER TABLE conformance_violation_event ADD CONSTRAINT conformance_violation_event_event_type_check
  CHECK (event_type IN ('observed', 'acknowledged', 'resolved', 'exempted', 'exemption_revoked'));
