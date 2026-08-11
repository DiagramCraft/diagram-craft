PRAGMA foreign_keys = OFF;

CREATE TABLE catalog_artifact_new (
  id                    TEXT PRIMARY KEY,
  workspace             TEXT NOT NULL,
  entity_id             TEXT NOT NULL,
  artifact_type         TEXT NOT NULL,
  source_key            TEXT,
  kind                  TEXT NOT NULL CHECK (kind IN ('document', 'url', 'repository', 'link')),
  location              TEXT,
  media_type            TEXT,
  status                TEXT NOT NULL CHECK (status IN ('not_configured', 'link_only', 'pending', 'current', 'stale', 'failed', 'invalid', 'unsupported')),
  refresh_schedule_id   TEXT,
  current_revision_id   TEXT,
  last_attempt_at       TEXT,
  last_success_at       TEXT,
  diagnostic_category   TEXT CHECK (diagnostic_category IS NULL OR diagnostic_category IN (
    'invalid_source', 'unsupported_media_type', 'unsupported_version', 'source_unavailable',
    'source_forbidden', 'source_timeout', 'source_too_large', 'security_blocked',
    'normalization_failed', 'source_disappeared'
  )),
  diagnostic_message    TEXT,
  diagnostic_timestamp  TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace, entity_id) REFERENCES catalog_record(workspace, id) ON DELETE CASCADE
);

INSERT INTO catalog_artifact_new (
  id, workspace, entity_id, artifact_type, source_key, kind, location, media_type, status,
  refresh_schedule_id, current_revision_id, last_attempt_at, last_success_at,
  diagnostic_category, diagnostic_message, diagnostic_timestamp, created_at, updated_at
)
SELECT
  id, workspace, entity_id, artifact_type,
  NULL, kind, location, media_type, status,
  NULL, current_revision_id, last_attempt_at, last_success_at,
  diagnostic_category, diagnostic_message, diagnostic_timestamp, created_at, updated_at
FROM catalog_artifact;

DROP TABLE catalog_artifact;
ALTER TABLE catalog_artifact_new RENAME TO catalog_artifact;

CREATE INDEX catalog_artifact_entity_idx ON catalog_artifact(workspace, entity_id, created_at);
CREATE UNIQUE INDEX catalog_artifact_source_identity_idx
  ON catalog_artifact(workspace, entity_id, artifact_type, source_key)
  WHERE source_key IS NOT NULL;

PRAGMA foreign_keys = ON;
