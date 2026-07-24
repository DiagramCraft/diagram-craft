ALTER TABLE entity ADD COLUMN project_id TEXT REFERENCES project(id) ON DELETE SET NULL;

CREATE INDEX entity_workspace_project_id_idx ON entity(workspace, project_id);
