-- @creates content_node
-- @creates content_mount
-- @creates external_content_source

CREATE TABLE IF NOT EXISTS external_content_source (
  id                TEXT PRIMARY KEY,
  workspace         TEXT NOT NULL,
  source_type       TEXT NOT NULL CHECK (source_type IN ('git')),
  source_config     TEXT NOT NULL DEFAULT '{}',
  identity_key      TEXT NOT NULL,
  schedule_id       TEXT UNIQUE,
  enabled           INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'succeeded', 'failed')),
  last_attempt_at   TEXT,
  last_synced_at    TEXT,
  last_revision     TEXT,
  last_error        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (workspace, source_type, identity_key),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES job_schedule(id) ON DELETE SET NULL
);

CREATE INDEX external_content_source_workspace_idx
  ON external_content_source(workspace, enabled);

CREATE TABLE IF NOT EXISTS content_mount (
  id                    TEXT PRIMARY KEY,
  workspace             TEXT NOT NULL,
  source_id             TEXT NOT NULL,
  project_id            TEXT,
  entity_id             TEXT,
  destination_path      TEXT NOT NULL,
  source_path           TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'succeeded', 'failed')),
  last_synced_at        TEXT,
  last_revision         TEXT,
  last_error            TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  CHECK (NOT (project_id IS NOT NULL AND entity_id IS NOT NULL)),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES external_content_source(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX content_mount_project_path_unique
  ON content_mount(workspace, project_id, destination_path) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX content_mount_entity_path_unique
  ON content_mount(workspace, entity_id, destination_path) WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX content_mount_workspace_path_unique
  ON content_mount(workspace, destination_path) WHERE project_id IS NULL AND entity_id IS NULL;
CREATE INDEX content_mount_source_idx ON content_mount(source_id);

ALTER TABLE content_node ADD COLUMN mount_id TEXT REFERENCES content_mount(id) ON DELETE CASCADE;
CREATE INDEX content_node_mount_idx ON content_node(workspace, mount_id);
