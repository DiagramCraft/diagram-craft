-- Durable state for storage/database operations that cannot share a transaction.
CREATE TABLE content_reconciliation (
  id                UUID PRIMARY KEY,
  workspace         UUID NOT NULL,
  operation         TEXT NOT NULL,
  scope             TEXT NOT NULL,
  node_ids          JSONB NOT NULL DEFAULT '[]',
  payload           JSONB NOT NULL DEFAULT '{}',
  state             TEXT NOT NULL CHECK (state IN ('pending', 'database_committed', 'resolving', 'resolved', 'failed')),
  attempt_count     INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at   TIMESTAMPTZ NOT NULL,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX content_reconciliation_due_idx
  ON content_reconciliation(workspace, state, next_attempt_at, created_at);
