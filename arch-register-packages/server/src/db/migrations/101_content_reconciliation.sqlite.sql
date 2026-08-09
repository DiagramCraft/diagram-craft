-- Durable state for storage/database operations that cannot share a transaction.
CREATE TABLE content_reconciliation (
  id                TEXT PRIMARY KEY,
  workspace         TEXT NOT NULL,
  operation         TEXT NOT NULL,
  scope             TEXT NOT NULL,
  node_ids          TEXT NOT NULL DEFAULT '[]',
  payload           TEXT NOT NULL DEFAULT '{}',
  state             TEXT NOT NULL CHECK (state IN ('pending', 'database_committed', 'resolving', 'resolved', 'failed')),
  attempt_count     INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at   TEXT NOT NULL,
  last_error        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  resolved_at       TEXT
);

CREATE INDEX content_reconciliation_due_idx
  ON content_reconciliation(workspace, state, next_attempt_at, created_at);
