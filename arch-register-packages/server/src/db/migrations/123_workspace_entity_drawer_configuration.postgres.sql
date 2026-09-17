-- Workspace-scoped, versioned entity drawer configuration (#3311).
CREATE TABLE workspace_entity_drawer_configuration (
  workspace UUID PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
