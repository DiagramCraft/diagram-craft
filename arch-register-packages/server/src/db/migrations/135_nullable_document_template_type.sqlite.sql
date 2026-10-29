PRAGMA foreign_keys = OFF;

CREATE TABLE document_template_new (
  id                TEXT PRIMARY KEY,
  workspace         TEXT NOT NULL,
  project_id        TEXT,
  name              TEXT NOT NULL,
  body              TEXT NOT NULL,
  document_type_id  TEXT,
  metadata_defaults TEXT NOT NULL DEFAULT '{}',
  archived          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (workspace, project_id, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, document_type_id) REFERENCES document_type(workspace, id) ON DELETE RESTRICT
);

INSERT INTO document_template_new (id, workspace, project_id, name, body, document_type_id, metadata_defaults, archived, created_at, updated_at)
  SELECT id, workspace, project_id, name, body, document_type_id, metadata_defaults, archived, created_at, updated_at
  FROM document_template;
DROP TABLE document_template;
ALTER TABLE document_template_new RENAME TO document_template;
CREATE INDEX document_template_workspace_idx ON document_template(workspace, project_id, archived, name);

PRAGMA foreign_keys = ON;
