-- #2527: Isolated workspace publication configuration for the public catalog.
CREATE TABLE workspace_public_catalog (
  workspace   TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  enabled     INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config      TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL,
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL
);
