PRAGMA foreign_keys = OFF;

CREATE TABLE conformance_violation_event_new (
  id             TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL,
  violation_id   TEXT NOT NULL,
  run_id         TEXT,
  event_type     TEXT NOT NULL CHECK (event_type IN ('observed', 'acknowledged', 'resolved', 'exempted', 'exemption_revoked')),
  details        TEXT NOT NULL DEFAULT '{}',
  occurred_at    TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (violation_id) REFERENCES conformance_violation(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES conformance_evaluation_run(id) ON DELETE SET NULL
);

INSERT INTO conformance_violation_event_new (id, workspace, violation_id, run_id, event_type, details, occurred_at)
  SELECT id, workspace, violation_id, run_id, event_type, details, occurred_at
  FROM conformance_violation_event;

DROP TABLE conformance_violation_event;
ALTER TABLE conformance_violation_event_new RENAME TO conformance_violation_event;

CREATE INDEX conformance_violation_event_idx
  ON conformance_violation_event(violation_id, occurred_at);

PRAGMA foreign_keys = ON;
