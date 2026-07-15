-- @creates document_type
-- @creates document_field
-- @creates document_template
-- @creates content_node_document
-- @creates document_link_index
CREATE TABLE document_type (
  id          UUID PRIMARY KEY,
  workspace   UUID NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  fields      JSONB NOT NULL DEFAULT '[]',
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX document_type_workspace_idx ON document_type(workspace, archived, name);

CREATE TABLE document_field (
  id                TEXT NOT NULL,
  workspace         UUID NOT NULL,
  document_type_id  UUID NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('text', 'long_text', 'boolean', 'date', 'number', 'enum', 'entity_link', 'document_link')),
  requirement       TEXT NOT NULL CHECK (requirement IN ('required', 'expected', 'optional')),
  min_cardinality   INTEGER,
  max_cardinality   INTEGER,
  enum_options      JSONB NOT NULL DEFAULT '[]',
  retired           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, document_type_id, id),
  FOREIGN KEY (workspace, document_type_id) REFERENCES document_type(workspace, id) ON DELETE CASCADE
);

CREATE TABLE document_template (
  id                UUID PRIMARY KEY,
  workspace         UUID NOT NULL,
  project_id        UUID,
  name              TEXT NOT NULL,
  body              TEXT NOT NULL,
  document_type_id  UUID,
  metadata_defaults JSONB NOT NULL DEFAULT '{}',
  archived          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, document_type_id) REFERENCES document_type(workspace, id) ON DELETE SET NULL
);

CREATE INDEX document_template_workspace_idx ON document_template(workspace, project_id, archived, name);

CREATE TABLE content_node_document (
  workspace         UUID NOT NULL,
  node_id           UUID PRIMARY KEY,
  document_type_id  UUID,
  "values"         JSONB NOT NULL DEFAULT '{}',
  updated_at        TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, document_type_id) REFERENCES document_type(workspace, id) ON DELETE SET NULL
);

CREATE TABLE document_link_index (
  workspace    UUID NOT NULL,
  node_id      UUID NOT NULL,
  field_id     TEXT NOT NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('entity', 'document')),
  target_id    UUID NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace, node_id, field_id, target_type, target_id, position),
  FOREIGN KEY (node_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE INDEX document_link_entity_idx ON document_link_index(workspace, target_type, target_id);
CREATE INDEX document_link_node_idx ON document_link_index(workspace, node_id);

ALTER TABLE content_node_revision ADD COLUMN document_type_id UUID;
ALTER TABLE content_node_revision ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
