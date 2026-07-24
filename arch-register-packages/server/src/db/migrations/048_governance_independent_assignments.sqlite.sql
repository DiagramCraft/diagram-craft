PRAGMA foreign_keys = OFF;

CREATE TABLE governance_event_new (
  id                 TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES governance_case(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL,
  event_type         TEXT NOT NULL CHECK (event_type IN (
                       'submitted', 'assigned', 'reassigned', 'changes_requested', 'resubmitted',
                       'approved', 'rejected', 'acknowledged', 'cancelled', 'admin_override',
                       'proposal_stale', 'domain_effect_applied', 'domain_effect_failed',
                       'scope_refreshed', 'postponed', 'finalized', 'finalization_override'
                     )),
  actor_user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  occurred_at        TEXT NOT NULL DEFAULT (datetime('now')),
  previous_status    TEXT,
  resulting_status   TEXT,
  reason             TEXT,
  metadata           TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO governance_event_new (id, case_id, workspace, event_type, actor_user_id, occurred_at, previous_status, resulting_status, reason, metadata)
  SELECT id, case_id, workspace, event_type, actor_user_id, occurred_at, previous_status, resulting_status, reason, metadata
  FROM governance_event;

DROP TABLE governance_event;
ALTER TABLE governance_event_new RENAME TO governance_event;

CREATE INDEX governance_event_case_idx ON governance_event(case_id, occurred_at);

PRAGMA foreign_keys = ON;
