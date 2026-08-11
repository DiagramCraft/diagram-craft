ALTER TABLE catalog_artifact ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE catalog_artifact ADD COLUMN IF NOT EXISTS refresh_schedule_id UUID;

ALTER TABLE catalog_artifact DROP CONSTRAINT IF EXISTS catalog_artifact_diagnostic_category_check;
ALTER TABLE catalog_artifact ADD CONSTRAINT catalog_artifact_diagnostic_category_check
  CHECK (diagnostic_category IS NULL OR diagnostic_category IN (
    'invalid_source', 'unsupported_media_type', 'unsupported_version', 'source_unavailable',
    'source_forbidden', 'source_timeout', 'source_too_large', 'security_blocked',
    'normalization_failed', 'source_disappeared'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS catalog_artifact_source_identity_idx
  ON catalog_artifact(workspace, entity_id, artifact_type, source_key)
  WHERE source_key IS NOT NULL;
