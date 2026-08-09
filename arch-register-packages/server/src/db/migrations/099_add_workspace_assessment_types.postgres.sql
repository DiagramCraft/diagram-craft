-- @creates workspace_assessment_type
CREATE TABLE IF NOT EXISTS workspace_assessment_type (
  id         UUID PRIMARY KEY,
  workspace  UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name)
);

CREATE INDEX IF NOT EXISTS workspace_assessment_type_workspace_idx
  ON workspace_assessment_type(workspace, sort_order, id);

ALTER TABLE assessment ADD COLUMN IF NOT EXISTS assessment_type_id UUID;
