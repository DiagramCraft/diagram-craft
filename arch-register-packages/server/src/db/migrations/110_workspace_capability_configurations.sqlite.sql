-- Workspace-scoped integration capability bindings.
CREATE TABLE workspace_capability_configuration (
  id         TEXT PRIMARY KEY,
  workspace  TEXT NOT NULL,
  type       TEXT NOT NULL,
  bindings   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, type),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX workspace_capability_configuration_workspace_idx
  ON workspace_capability_configuration(workspace, type);
