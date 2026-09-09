-- Workspace application access policies. Missing policies deny ordinary members.
CREATE TABLE workspace_application_access (
  workspace     TEXT NOT NULL,
  application_id TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('all_members', 'selected')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (workspace, application_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE workspace_application_access_user (
  workspace      TEXT NOT NULL,
  application_id TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  PRIMARY KEY (workspace, application_id, user_id),
  FOREIGN KEY (workspace, application_id)
    REFERENCES workspace_application_access(workspace, application_id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, user_id)
    REFERENCES workspace_member(workspace, user_id) ON DELETE CASCADE
);

CREATE TABLE workspace_application_access_team (
  workspace      TEXT NOT NULL,
  application_id TEXT NOT NULL,
  team_id        TEXT NOT NULL,
  PRIMARY KEY (workspace, application_id, team_id),
  FOREIGN KEY (workspace, application_id)
    REFERENCES workspace_application_access(workspace, application_id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, team_id)
    REFERENCES workspace_owner(workspace, id) ON DELETE CASCADE
);

CREATE INDEX workspace_application_access_user_idx
  ON workspace_application_access_user(workspace, user_id);

CREATE INDEX workspace_application_access_team_idx
  ON workspace_application_access_team(workspace, team_id);
