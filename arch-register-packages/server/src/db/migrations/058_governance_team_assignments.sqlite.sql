PRAGMA foreign_keys = OFF;

CREATE TABLE governance_assignment_new (
  id                 TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES governance_case(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL,
  action             TEXT NOT NULL CHECK (action IN ('approve', 'acknowledge', 'review', 'remediate')),
  target_type        TEXT NOT NULL CHECK (target_type IN ('user', 'team', 'team_role', 'capability')),
  target_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_team_id     TEXT,
  target_team_role   TEXT CHECK (target_team_role IN ('team_admin', 'team_editor', 'team_reviewer')),
  target_capability  TEXT,
  status             TEXT NOT NULL CHECK (status IN ('open', 'completed', 'superseded')) DEFAULT 'open',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at        TEXT,
  FOREIGN KEY (workspace, target_team_id) REFERENCES workspace_owner(workspace, id) ON DELETE CASCADE
);

INSERT INTO governance_assignment_new
  SELECT id, case_id, workspace, action, target_type, target_user_id, target_team_id,
         target_team_role, target_capability, status, created_at, resolved_at
  FROM governance_assignment;

DROP TABLE governance_assignment;
ALTER TABLE governance_assignment_new RENAME TO governance_assignment;

CREATE INDEX governance_assignment_case_idx ON governance_assignment(case_id, status);
CREATE INDEX governance_assignment_user_idx ON governance_assignment(target_user_id, status);
CREATE INDEX governance_assignment_team_idx ON governance_assignment(workspace, target_team_id, target_team_role, status);
CREATE INDEX governance_assignment_capability_idx ON governance_assignment(workspace, target_capability, status);

PRAGMA foreign_keys = ON;
