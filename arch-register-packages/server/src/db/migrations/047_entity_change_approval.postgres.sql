ALTER TABLE entity ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS approval_policy_override TEXT
  CHECK (approval_policy_override IN ('required', 'disabled'));
ALTER TABLE entity_schema ADD COLUMN IF NOT EXISTS entity_approval_policy TEXT NOT NULL DEFAULT 'disabled'
  CHECK (entity_approval_policy IN ('required', 'disabled'));

-- @creates entity_change_proposal
CREATE TABLE IF NOT EXISTS entity_change_proposal (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace          UUID NOT NULL,
  entity_id          UUID NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('open', 'approved', 'rejected', 'withdrawn')),
  initiator_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL,
  closed_at          TIMESTAMPTZ,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_change_proposal_one_open_idx
  ON entity_change_proposal(workspace, entity_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS entity_change_proposal_workspace_status_idx
  ON entity_change_proposal(workspace, status, updated_at DESC);

-- @creates entity_change_proposal_revision
CREATE TABLE IF NOT EXISTS entity_change_proposal_revision (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id        UUID NOT NULL REFERENCES entity_change_proposal(id) ON DELETE CASCADE,
  workspace          UUID NOT NULL,
  entity_id          UUID NOT NULL,
  revision_number    INTEGER NOT NULL,
  base_version       INTEGER NOT NULL,
  base_state         JSONB NOT NULL,
  proposed_state     JSONB NOT NULL,
  diff               JSONB NOT NULL,
  policy_version     TEXT NOT NULL,
  resolved_policy    JSONB NOT NULL,
  message            TEXT,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  status             TEXT NOT NULL CHECK (status IN ('submitted', 'changes_requested', 'stale', 'approved', 'rejected', 'withdrawn')),
  created_at         TIMESTAMPTZ NOT NULL,
  resolved_at        TIMESTAMPTZ,
  UNIQUE (proposal_id, revision_number),
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS entity_change_proposal_revision_entity_idx
  ON entity_change_proposal_revision(workspace, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS entity_change_proposal_revision_proposal_idx
  ON entity_change_proposal_revision(proposal_id, revision_number DESC);
