-- @creates workspace_enum_version
-- @creates workspace_field_group_version
-- @creates workspace_category_version
CREATE TABLE workspace_enum_version (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  change_summary TEXT,
  publication_id TEXT REFERENCES schema_publication(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace, item_id, version)
);
CREATE INDEX workspace_enum_version_item_idx ON workspace_enum_version(workspace, item_id, version DESC);

CREATE TABLE workspace_field_group_version (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  change_summary TEXT,
  publication_id TEXT REFERENCES schema_publication(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace, item_id, version)
);
CREATE INDEX workspace_field_group_version_item_idx ON workspace_field_group_version(workspace, item_id, version DESC);

CREATE TABLE workspace_category_version (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  change_summary TEXT,
  publication_id TEXT REFERENCES schema_publication(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace, item_id, version)
);
CREATE INDEX workspace_category_version_item_idx ON workspace_category_version(workspace, item_id, version DESC);
