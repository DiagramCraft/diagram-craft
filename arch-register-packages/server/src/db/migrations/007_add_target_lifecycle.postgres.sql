ALTER TABLE entity ADD COLUMN target_lifecycle UUID;
ALTER TABLE entity ADD COLUMN target_lifecycle_date TEXT;
ALTER TABLE entity
  ADD CONSTRAINT entity_workspace_target_lifecycle_fk
  FOREIGN KEY (workspace, target_lifecycle)
  REFERENCES workspace_lifecycle_state(workspace, id)
  ON DELETE SET NULL;
CREATE INDEX entity_workspace_target_lifecycle_idx ON entity(workspace, target_lifecycle);
