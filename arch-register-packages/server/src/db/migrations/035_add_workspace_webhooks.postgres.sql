-- @creates workspace_webhook
CREATE TABLE workspace_webhook (
  id           UUID PRIMARY KEY,
  workspace    UUID NOT NULL,
  url          TEXT NOT NULL,
  event_filter JSONB NOT NULL,
  hmac_secret  TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX workspace_webhook_workspace_idx
  ON workspace_webhook(workspace, enabled);
