ALTER TABLE workspace_lifecycle_state ADD COLUMN is_deprecated_state BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX workspace_lifecycle_state_one_deprecated_idx
  ON workspace_lifecycle_state(workspace)
  WHERE is_deprecated_state;

CREATE UNIQUE INDEX governance_case_one_open_deprecation_idx
  ON governance_case(workspace, subject_type, subject_id)
  WHERE status = 'open' AND case_kind = 'entity.deprecation';

-- @creates entity_deprecation_ack
CREATE TABLE entity_deprecation_ack (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                   UUID NOT NULL REFERENCES governance_case(id) ON DELETE CASCADE,
  workspace                 UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  owner_team_id             UUID NOT NULL,
  assignment_id             UUID NOT NULL REFERENCES governance_assignment(id) ON DELETE CASCADE,
  status                    TEXT NOT NULL CHECK (status IN ('open', 'completed')) DEFAULT 'open',
  actor_user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  comment                   TEXT,
  planned_remediation       TEXT,
  remediation_project_id    UUID,
  target_remediation_date   TEXT,
  risk_accepted             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at               TIMESTAMPTZ,
  FOREIGN KEY (workspace, owner_team_id) REFERENCES workspace_owner(workspace, id) ON DELETE CASCADE
);

CREATE INDEX entity_deprecation_ack_case_idx ON entity_deprecation_ack(case_id, status);
CREATE INDEX entity_deprecation_ack_team_idx ON entity_deprecation_ack(workspace, owner_team_id, status);
CREATE UNIQUE INDEX entity_deprecation_ack_assignment_idx ON entity_deprecation_ack(assignment_id);
