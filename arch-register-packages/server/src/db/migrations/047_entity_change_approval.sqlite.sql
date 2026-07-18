ALTER TABLE entity ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE entity ADD COLUMN approval_policy_override TEXT CHECK (approval_policy_override IN ('required', 'disabled'));
ALTER TABLE entity_schema ADD COLUMN entity_approval_policy TEXT NOT NULL DEFAULT 'disabled'
  CHECK (entity_approval_policy IN ('required', 'disabled'));

-- @creates entity_change_proposal
CREATE TABLE entity_change_proposal (
  id                 TEXT PRIMARY KEY,
  workspace          TEXT NOT NULL,
  entity_id          TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('open', 'approved', 'rejected', 'withdrawn')),
  initiator_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  closed_at          TEXT,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX entity_change_proposal_one_open_idx
  ON entity_change_proposal(workspace, entity_id) WHERE status = 'open';
CREATE INDEX entity_change_proposal_workspace_status_idx
  ON entity_change_proposal(workspace, status, updated_at DESC);

-- @creates entity_change_proposal_revision
CREATE TABLE entity_change_proposal_revision (
  id                 TEXT PRIMARY KEY,
  proposal_id        TEXT NOT NULL REFERENCES entity_change_proposal(id) ON DELETE CASCADE,
  workspace          TEXT NOT NULL,
  entity_id          TEXT NOT NULL,
  revision_number    INTEGER NOT NULL,
  base_version       INTEGER NOT NULL,
  base_state         TEXT NOT NULL,
  proposed_state     TEXT NOT NULL,
  diff               TEXT NOT NULL,
  policy_version     TEXT NOT NULL,
  resolved_policy    TEXT NOT NULL,
  message            TEXT,
  created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  status             TEXT NOT NULL CHECK (status IN ('submitted', 'changes_requested', 'stale', 'approved', 'rejected', 'withdrawn')),
  created_at         TEXT NOT NULL,
  resolved_at        TEXT,
  UNIQUE (proposal_id, revision_number),
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX entity_change_proposal_revision_entity_idx
  ON entity_change_proposal_revision(workspace, entity_id, created_at DESC);
CREATE INDEX entity_change_proposal_revision_proposal_idx
  ON entity_change_proposal_revision(proposal_id, revision_number DESC);
