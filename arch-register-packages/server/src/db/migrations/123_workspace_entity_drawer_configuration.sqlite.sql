-- Workspace-scoped, versioned entity drawer configuration (#3311).
CREATE TABLE workspace_entity_drawer_configuration (
  workspace TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  configuration TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
