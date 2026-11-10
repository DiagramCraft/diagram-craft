CREATE TABLE schema_draft (
  workspace TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE schema_draft_item (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES schema_draft(workspace) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('entity_schema', 'relation_schema', 'document_type', 'enum', 'field_group', 'category')),
  item_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('create', 'update', 'delete')),
  payload TEXT,
  base_version TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace, kind, item_id)
);
