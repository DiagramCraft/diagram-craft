-- #2527: Isolated workspace publication configuration for the public catalog.
CREATE TABLE workspace_public_catalog (
  workspace   UUID PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);
