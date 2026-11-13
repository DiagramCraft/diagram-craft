-- @creates workspace_enum_version
-- @creates workspace_field_group_version
-- @creates workspace_category_version
CREATE TABLE workspace_enum_version (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  publication_id UUID REFERENCES schema_publication(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, item_id, version)
);
CREATE INDEX workspace_enum_version_item_idx ON workspace_enum_version(workspace, item_id, version DESC);

CREATE TABLE workspace_field_group_version (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  publication_id UUID REFERENCES schema_publication(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, item_id, version)
);
CREATE INDEX workspace_field_group_version_item_idx ON workspace_field_group_version(workspace, item_id, version DESC);

CREATE TABLE workspace_category_version (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  publication_id UUID REFERENCES schema_publication(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, item_id, version)
);
CREATE INDEX workspace_category_version_item_idx ON workspace_category_version(workspace, item_id, version DESC);
