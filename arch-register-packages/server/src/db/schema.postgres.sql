-- Base schema only. Keep this file at the pre-migration baseline and let
-- runPostgresMigrations() apply all incremental changes.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE workspace (
  id          UUID        PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  url_slug    TEXT        NOT NULL UNIQUE,
  short_code  TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE workspace_lifecycle_state (
  id          UUID        PRIMARY KEY,
  workspace   UUID        NOT NULL,
  label       TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT 'var(--fg-3)',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE workspace_owner (
  id          UUID        PRIMARY KEY,
  workspace   UUID        NOT NULL,
  name        TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  color       TEXT,
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, id),
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE entity_schema (
  id            UUID        PRIMARY KEY,
  workspace     UUID        NOT NULL,
  name          TEXT        NOT NULL,
  fields        JSONB       NOT NULL DEFAULT '[]',
  color         TEXT,
  icon          TEXT,
  default_owner UUID,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, default_owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

CREATE TABLE entity (
  id                    UUID        PRIMARY KEY,
  workspace             UUID        NOT NULL,
  slug                  TEXT        NOT NULL,
  namespace             TEXT        NOT NULL DEFAULT 'default',
  name                  TEXT        NOT NULL,
  description           TEXT        NOT NULL DEFAULT '',
  owner                 UUID,
  lifecycle             UUID,
  tags                  JSONB       NOT NULL DEFAULT '[]',
  links                 JSONB       NOT NULL DEFAULT '[]',
  schema_id             UUID        NOT NULL,
  data                  JSONB       NOT NULL DEFAULT '{}',
  visibility_mode       TEXT CHECK (visibility_mode IN ('public', 'restricted')),
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL,
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
  id              UUID        PRIMARY KEY,
  workspace       UUID        NOT NULL,
  entity_id       UUID        NOT NULL,
  principal_type  TEXT        NOT NULL CHECK (principal_type IN ('user', 'team')),
  principal_id    UUID        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('viewer', 'editor', 'contributor', 'entity_admin')),
  applies_to      TEXT        NOT NULL CHECK (applies_to IN ('self', 'subtree')),
  created_at      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX entity_grant_workspace_entity_idx ON entity_grant(workspace, entity_id);
CREATE INDEX entity_grant_workspace_principal_idx ON entity_grant(workspace, principal_type, principal_id);

CREATE TABLE project (
  id          UUID        PRIMARY KEY,
  workspace   UUID        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  owner       UUID,
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('pinned', 'active', 'archived')),
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace, name),
  UNIQUE (workspace, id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, owner) REFERENCES workspace_owner(workspace, id) ON DELETE SET NULL
);

CREATE TABLE content_node (
  id                       UUID        PRIMARY KEY,
  workspace                UUID        NOT NULL,
  project_id               UUID,
  entity_id                UUID,
  parent_id                UUID,
  path                     TEXT        NOT NULL,
  name                     TEXT        NOT NULL,
  type                     TEXT        NOT NULL DEFAULT 'diagram' CHECK (type IN ('diagram', 'folder')),
  size_bytes               INTEGER     NOT NULL DEFAULT 0,
  is_template              BOOLEAN     NOT NULL DEFAULT FALSE,
  is_workspace_template    BOOLEAN     NOT NULL DEFAULT FALSE,
  preview_svg              TEXT,
  comment_count            INTEGER     NOT NULL DEFAULT 0,
  unresolved_comment_count INTEGER     NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL,
  updated_at               TIMESTAMPTZ NOT NULL,
  CHECK (NOT (project_id IS NOT NULL AND entity_id IS NOT NULL)),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace, project_id) REFERENCES project(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES content_node(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX content_node_project_unique ON content_node(workspace, project_id, path) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX content_node_entity_unique ON content_node(workspace, entity_id, path) WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX content_node_workspace_unique ON content_node(workspace, path) WHERE project_id IS NULL AND entity_id IS NULL;
CREATE INDEX content_node_project_idx ON content_node(workspace, project_id);
CREATE INDEX content_node_entity_idx ON content_node(workspace, entity_id);
CREATE INDEX content_node_workspace_idx ON content_node(workspace) WHERE project_id IS NULL AND entity_id IS NULL;

CREATE TABLE users (
  id              UUID        PRIMARY KEY,
  user_id         TEXT        NOT NULL UNIQUE,
  email           TEXT        UNIQUE,
  display_name    TEXT        NOT NULL,
  auth_provider   TEXT        NOT NULL CHECK (auth_provider IN ('local', 'oidc')),
  password_hash   TEXT,
  oidc_issuer     TEXT,
  oidc_subject    TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  color           TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  last_login_at   TIMESTAMPTZ,
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_auth_provider_idx ON users(auth_provider);
CREATE INDEX users_oidc_idx ON users(oidc_issuer, oidc_subject) WHERE auth_provider = 'oidc';

CREATE TABLE audit_log (
  id              UUID        PRIMARY KEY,
  workspace       UUID        NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL,
  user_id         UUID,
  operation       TEXT        NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type     TEXT        NOT NULL CHECK (entity_type IN ('workspace', 'entity_schema', 'entity', 'project', 'content_node')),
  entity_id       UUID        NOT NULL,
  entity_name     TEXT        NOT NULL,
  entity_slug     TEXT,
  schema_id       UUID,
  changes         JSONB       NOT NULL DEFAULT '{}',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX audit_log_workspace_timestamp_idx ON audit_log(workspace, timestamp DESC);

CREATE TABLE team_membership (
  workspace   UUID        NOT NULL,
  team_id     UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('team_admin', 'team_editor', 'team_reviewer')),
  created_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, team_id, user_id),
  FOREIGN KEY (workspace, team_id) REFERENCES workspace_owner(workspace, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE global_role_assignment (
  user_id      UUID        NOT NULL,
  role         TEXT        NOT NULL CHECK (role IN ('global_admin', 'workspace_admin')),
  created_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE workspace_member (
  workspace   UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  role        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, user_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX workspace_member_user_idx ON workspace_member(user_id);
CREATE INDEX workspace_member_role_idx ON workspace_member(workspace, role);

CREATE TABLE workspace_role (
  id           UUID        NOT NULL,
  workspace    UUID        NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  tone         TEXT        NOT NULL DEFAULT 'var(--accent)',
  capabilities JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, id),
  UNIQUE (workspace, name),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE workspace_ai_config (
  workspace       UUID        PRIMARY KEY,
  provider        TEXT        NOT NULL DEFAULT 'openrouter',
  api_key_enc     TEXT,
  base_url        TEXT,
  model           TEXT,
  temperature     REAL,
  system_prompt   TEXT,
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE ai_conversation (
  id              UUID        PRIMARY KEY,
  workspace       UUID        NOT NULL,
  user_id         UUID        NOT NULL,
  title           TEXT        NOT NULL DEFAULT 'New chat',
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX ai_conversation_ws_user_idx ON ai_conversation(workspace, user_id, updated_at DESC);

CREATE TABLE ai_message (
  id              UUID        PRIMARY KEY,
  conversation_id UUID        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE
);

CREATE INDEX ai_message_conversation_idx ON ai_message(conversation_id, created_at);
