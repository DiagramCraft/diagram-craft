-- #2827: OpenAPI and AsyncAPI revision projections.
CREATE TABLE catalog_api_spec_revision (
  workspace              TEXT NOT NULL,
  artifact_revision_id   TEXT NOT NULL,
  protocol               TEXT CHECK (protocol IS NULL OR protocol IN ('openapi', 'asyncapi')),
  specification_version  TEXT,
  title                  TEXT,
  description            TEXT,
  status                 TEXT NOT NULL CHECK (status IN ('current', 'invalid', 'unsupported')),
  item_count             INTEGER NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  PRIMARY KEY (workspace, artifact_revision_id),
  FOREIGN KEY (workspace, artifact_revision_id)
    REFERENCES catalog_artifact_revision(workspace, id) ON DELETE CASCADE
);

CREATE TABLE catalog_api_spec_item (
  id                     TEXT PRIMARY KEY,
  workspace              TEXT NOT NULL,
  artifact_revision_id   TEXT NOT NULL,
  item_key               TEXT NOT NULL,
  protocol               TEXT NOT NULL CHECK (protocol IN ('openapi', 'asyncapi')),
  item_kind              TEXT NOT NULL CHECK (item_kind IN ('operation', 'message')),
  path                   TEXT,
  channel                TEXT,
  action                 TEXT NOT NULL,
  identifier             TEXT NOT NULL,
  declared_identifier    TEXT,
  summary                TEXT,
  description            TEXT,
  deprecated             INTEGER NOT NULL CHECK (deprecated IN (0, 1)),
  parameters             TEXT NOT NULL,
  input_summary          TEXT,
  output_summary         TEXT,
  metadata               TEXT NOT NULL,
  source_pointer         TEXT NOT NULL,
  source_line            INTEGER,
  source_column          INTEGER,
  sort_order             INTEGER NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, artifact_revision_id, item_key),
  FOREIGN KEY (workspace, artifact_revision_id)
    REFERENCES catalog_api_spec_revision(workspace, artifact_revision_id) ON DELETE CASCADE
);

CREATE INDEX catalog_api_spec_item_revision_idx
  ON catalog_api_spec_item(workspace, artifact_revision_id, sort_order, id);
CREATE INDEX catalog_api_spec_item_action_idx
  ON catalog_api_spec_item(workspace, artifact_revision_id, action);
CREATE INDEX catalog_api_spec_item_path_idx
  ON catalog_api_spec_item(workspace, artifact_revision_id, path);

CREATE TABLE catalog_api_spec_item_tag (
  workspace              TEXT NOT NULL,
  item_id                TEXT NOT NULL,
  tag                    TEXT NOT NULL,
  PRIMARY KEY (workspace, item_id, tag),
  FOREIGN KEY (workspace, item_id) REFERENCES catalog_api_spec_item(workspace, id) ON DELETE CASCADE
);

CREATE INDEX catalog_api_spec_item_tag_lookup_idx
  ON catalog_api_spec_item_tag(workspace, tag, item_id);

CREATE TABLE catalog_api_spec_diagnostic (
  id                     TEXT PRIMARY KEY,
  workspace              TEXT NOT NULL,
  artifact_revision_id   TEXT NOT NULL,
  severity               TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
  category               TEXT NOT NULL,
  code                   TEXT NOT NULL,
  message                TEXT NOT NULL,
  source_pointer         TEXT,
  source_line            INTEGER,
  source_column          INTEGER,
  sort_order             INTEGER NOT NULL,
  UNIQUE (workspace, artifact_revision_id, id),
  FOREIGN KEY (workspace, artifact_revision_id)
    REFERENCES catalog_api_spec_revision(workspace, artifact_revision_id) ON DELETE CASCADE
);

CREATE INDEX catalog_api_spec_diagnostic_revision_idx
  ON catalog_api_spec_diagnostic(workspace, artifact_revision_id, sort_order);
