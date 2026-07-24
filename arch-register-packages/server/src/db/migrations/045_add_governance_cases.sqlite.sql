-- @creates governance_case
CREATE TABLE governance_case (
  id                     TEXT PRIMARY KEY,
  workspace              TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  case_kind              TEXT NOT NULL,
  subject_type           TEXT NOT NULL,
  subject_id             TEXT NOT NULL,
  subject_version        TEXT,
  status                 TEXT NOT NULL CHECK (status IN ('open', 'completed', 'cancelled')) DEFAULT 'open',
  outcome                TEXT,
  policy_version         TEXT,
  initiator_user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  parent_case_id         TEXT REFERENCES governance_case(id) ON DELETE SET NULL,
  self_approval_allowed  INTEGER NOT NULL DEFAULT 0,
  payload                TEXT NOT NULL DEFAULT '{}',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  due_at                 TEXT,
  completed_at           TEXT,
  cancelled_at           TEXT
);

CREATE INDEX governance_case_workspace_status_idx ON governance_case(workspace, status);
CREATE INDEX governance_case_subject_idx ON governance_case(workspace, subject_type, subject_id);

-- @creates governance_assignment
CREATE TABLE governance_assignment (
  id                 TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES governance_case(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL,
  action             TEXT NOT NULL CHECK (action IN ('approve', 'acknowledge', 'review', 'remediate')),
  target_type        TEXT NOT NULL CHECK (target_type IN ('user', 'team_role', 'capability')),
  target_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_team_id     TEXT,
  target_team_role   TEXT CHECK (target_team_role IN ('team_admin', 'team_editor', 'team_reviewer')),
  target_capability  TEXT,
  status             TEXT NOT NULL CHECK (status IN ('open', 'completed', 'superseded')) DEFAULT 'open',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at        TEXT,
  FOREIGN KEY (workspace, target_team_id) REFERENCES workspace_owner(workspace, id) ON DELETE CASCADE
);

CREATE INDEX governance_assignment_case_idx ON governance_assignment(case_id, status);
CREATE INDEX governance_assignment_user_idx ON governance_assignment(target_user_id, status);
CREATE INDEX governance_assignment_team_idx ON governance_assignment(workspace, target_team_id, target_team_role, status);
CREATE INDEX governance_assignment_capability_idx ON governance_assignment(workspace, target_capability, status);

-- @creates governance_event
CREATE TABLE governance_event (
  id                 TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES governance_case(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL,
  event_type         TEXT NOT NULL CHECK (event_type IN (
                       'submitted', 'assigned', 'reassigned', 'changes_requested', 'resubmitted',
                       'approved', 'rejected', 'acknowledged', 'cancelled', 'admin_override',
                       'proposal_stale', 'domain_effect_applied', 'domain_effect_failed'
                     )),
  actor_user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  occurred_at        TEXT NOT NULL DEFAULT (datetime('now')),
  previous_status    TEXT,
  resulting_status   TEXT,
  reason             TEXT,
  metadata           TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX governance_event_case_idx ON governance_event(case_id, occurred_at);

-- @creates governance_decision_request
CREATE TABLE governance_decision_request (
  assignment_id    TEXT NOT NULL REFERENCES governance_assignment(id) ON DELETE CASCADE,
  idempotency_key  TEXT NOT NULL,
  event_id         TEXT NOT NULL REFERENCES governance_event(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, idempotency_key)
);
