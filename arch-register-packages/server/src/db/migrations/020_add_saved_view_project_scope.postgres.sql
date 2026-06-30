ALTER TABLE saved_view
  ADD COLUMN project_id UUID REFERENCES project(id) ON DELETE CASCADE,
  ADD COLUMN project_scope TEXT;

CREATE INDEX saved_view_workspace_project_idx ON saved_view(workspace, project_id);
