CREATE TABLE schema_draft (
  workspace UUID PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE schema_draft_item (
  id UUID PRIMARY KEY,
  workspace UUID NOT NULL REFERENCES schema_draft(workspace) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('entity_schema', 'relation_schema', 'document_type', 'enum', 'field_group', 'category')),
  item_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('create', 'update', 'delete')),
  payload JSONB,
  base_version TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, kind, item_id)
);
