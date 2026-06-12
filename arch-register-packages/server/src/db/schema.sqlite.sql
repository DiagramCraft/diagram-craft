-- Base schema only. Keep this file at the pre-migration baseline and let
-- runSqliteMigrations() apply all incremental changes.
PRAGMA foreign_keys = ON;

CREATE TABLE workspace (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  url_slug    TEXT NOT NULL UNIQUE,
  short_code  TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE workspace_lifecycle_state (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'var(--fg-3)',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE workspace_owner (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  color       TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE entity_schema (
  id            TEXT PRIMARY KEY,
  workspace     TEXT NOT NULL,
  name          TEXT NOT NULL,
  fields        TEXT NOT NULL DEFAULT '[]',
  color         TEXT,
  icon          TEXT,
  default_owner TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, default_owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

CREATE TABLE entity (
  id                    TEXT PRIMARY KEY,
  workspace             TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  namespace             TEXT NOT NULL DEFAULT 'default',
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  owner                 TEXT,
  lifecycle             TEXT,
  tags                  TEXT NOT NULL DEFAULT '[]',
  links                 TEXT NOT NULL DEFAULT '[]',
  schema_id             TEXT NOT NULL,
  data                  TEXT NOT NULL DEFAULT '{}',
  visibility_mode       TEXT CHECK (visibility_mode IN ('public', 'restricted')),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (workspace, schema_id, namespace, slug),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, lifecycle) REFERENCES workspace_lifecycle_state(workspace, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace, schema_id) REFERENCES entity_schema(workspace, id) ON DELETE RESTRICT
);

CREATE INDEX entity_workspace_schema_id_idx ON entity(workspace, schema_id);
CREATE INDEX entity_workspace_owner_idx ON entity(workspace, owner);
CREATE INDEX entity_workspace_lifecycle_idx ON entity(workspace, lifecycle);
CREATE INDEX entity_workspace_name_idx ON entity(workspace, name);
CREATE INDEX entity_workspace_visibility_mode_idx ON entity(workspace, visibility_mode);

CREATE TABLE entity_grant (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  principal_type  TEXT NOT NULL CHECK (principal_type IN ('user', 'team')),
  principal_id    TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'contributor', 'entity_admin')),
  applies_to      TEXT NOT NULL CHECK (applies_to IN ('self', 'subtree')),
  created_at      TEXT NOT NULL,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX entity_grant_workspace_entity_idx ON entity_grant(workspace, entity_id);
CREATE INDEX entity_grant_workspace_principal_idx ON entity_grant(workspace, principal_type, principal_id);

CREATE TABLE project (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pinned', 'active', 'archived')),
  color       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

CREATE TABLE content_node (
  id                       TEXT    PRIMARY KEY,
  workspace                TEXT    NOT NULL,
  project_id               TEXT    NOT NULL,
  parent_id                TEXT,
  path                     TEXT    NOT NULL,
  name                     TEXT    NOT NULL,
  type                     TEXT    NOT NULL DEFAULT 'diagram' CHECK (type IN ('diagram', 'folder')),
  size_bytes               INTEGER NOT NULL DEFAULT 0,
  is_template              INTEGER NOT NULL DEFAULT 0,
  is_workspace_template    INTEGER NOT NULL DEFAULT 0,
  preview_svg              TEXT,
  comment_count            INTEGER NOT NULL DEFAULT 0,
  unresolved_comment_count INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT    NOT NULL,
  updated_at               TEXT    NOT NULL,
  UNIQUE (workspace, project_id, path),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE INDEX content_node_project_idx ON content_node(workspace, project_id);

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  auth_provider   TEXT NOT NULL CHECK (auth_provider IN ('local', 'oidc')),
  password_hash   TEXT,
  oidc_issuer     TEXT,
  oidc_subject    TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  color           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  last_login_at   TEXT,
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_auth_provider_idx ON users(auth_provider);
CREATE INDEX users_oidc_idx ON users(oidc_issuer, oidc_subject) WHERE auth_provider = 'oidc';

CREATE TABLE audit_log (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  user_id         TEXT,
  operation       TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('workspace', 'entity_schema', 'entity', 'project', 'project_file', 'content_node')),
  entity_id       TEXT NOT NULL,
  entity_name     TEXT NOT NULL,
  entity_slug     TEXT,
  schema_id       TEXT,
  changes         TEXT NOT NULL DEFAULT '{}',
  metadata        TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX audit_log_workspace_timestamp_idx ON audit_log(workspace, timestamp DESC);

CREATE TABLE team_membership (
  workspace   TEXT NOT NULL,
  team_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('team_admin', 'team_editor', 'team_reviewer')),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (workspace, team_id, user_id),
  FOREIGN KEY (workspace, team_id) REFERENCES workspace_owner(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE global_role_assignment (
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('global_admin', 'workspace_admin')),
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE workspace_member (
  workspace   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (workspace, user_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX workspace_member_user_idx ON workspace_member(user_id);
CREATE INDEX workspace_member_role_idx ON workspace_member(workspace, role);

CREATE TABLE workspace_role (
  id           TEXT NOT NULL,
  workspace    TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  tone         TEXT NOT NULL DEFAULT 'var(--accent)',
  capabilities TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (workspace, id),
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE workspace_ai_config (
  workspace       TEXT PRIMARY KEY,
  provider        TEXT NOT NULL DEFAULT 'openrouter',
  api_key_enc     TEXT,
  base_url        TEXT,
  model           TEXT,
  temperature     REAL,
  system_prompt   TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE ai_conversation (
  id              TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT 'New chat',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX ai_conversation_ws_user_idx ON ai_conversation(workspace, user_id, updated_at DESC);

CREATE TABLE ai_message (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content         TEXT NOT NULL,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE
);

CREATE INDEX ai_message_conversation_idx ON ai_message(conversation_id, created_at);
