ALTER TABLE entity ADD COLUMN target_lifecycle TEXT;
ALTER TABLE entity ADD COLUMN target_lifecycle_date TEXT;
CREATE INDEX entity_workspace_target_lifecycle_idx ON entity(workspace, target_lifecycle);
