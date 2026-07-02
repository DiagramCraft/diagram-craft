ALTER TABLE entity_snapshot DROP CONSTRAINT IF EXISTS entity_snapshot_status_check;
ALTER TABLE entity_snapshot ADD CONSTRAINT entity_snapshot_status_check
  CHECK (status IN ('autosave', 'saved_version', 'future_update', 'applied', 'deleted'));
