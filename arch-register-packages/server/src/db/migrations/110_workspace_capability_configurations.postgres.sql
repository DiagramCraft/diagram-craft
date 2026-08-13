-- Workspace-scoped integration capability bindings.
CREATE TABLE workspace_capability_configuration (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace  UUID NOT NULL,
  type       TEXT NOT NULL,
  bindings   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, type),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX workspace_capability_configuration_workspace_idx
  ON workspace_capability_configuration(workspace, type);
