-- #2826: generic functionality-driving artifact lifecycle.

CREATE TABLE catalog_artifact (
  id                    UUID PRIMARY KEY,
  workspace             UUID NOT NULL,
  entity_id             UUID NOT NULL,
  artifact_type         TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('document', 'url', 'repository', 'link')),
  location              TEXT,
  media_type            TEXT,
  status                TEXT NOT NULL CHECK (status IN ('not_configured', 'link_only', 'pending', 'current', 'stale', 'failed', 'invalid', 'unsupported')),
  current_revision_id   UUID,
  last_attempt_at       TIMESTAMPTZ,
  last_success_at       TIMESTAMPTZ,
  diagnostic_category   TEXT CHECK (diagnostic_category IS NULL OR diagnostic_category IN (
    'invalid_source', 'unsupported_media_type', 'unsupported_version', 'source_unavailable',
    'source_forbidden', 'source_timeout', 'source_too_large', 'security_blocked', 'normalization_failed'
  )),
  diagnostic_message    TEXT,
  diagnostic_timestamp  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace, entity_id) REFERENCES catalog_record(workspace, id) ON DELETE CASCADE
);

CREATE INDEX catalog_artifact_entity_idx ON catalog_artifact(workspace, entity_id, created_at);

CREATE TABLE catalog_artifact_revision (
  id              UUID PRIMARY KEY,
  workspace       UUID NOT NULL,
  artifact_id     UUID NOT NULL,
  source_revision TEXT,
  checksum        TEXT NOT NULL,
  media_type      TEXT,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, artifact_id, checksum),
  FOREIGN KEY (workspace, artifact_id) REFERENCES catalog_artifact(workspace, id) ON DELETE CASCADE
);

CREATE INDEX catalog_artifact_revision_artifact_idx ON catalog_artifact_revision(workspace, artifact_id, created_at DESC);
