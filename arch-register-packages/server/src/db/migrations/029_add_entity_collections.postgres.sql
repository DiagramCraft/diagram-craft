-- @creates user_collection_entity
-- @creates user_collection
CREATE TABLE user_collection (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace  UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_collection_entity (
  collection_id UUID NOT NULL REFERENCES user_collection(id) ON DELETE CASCADE,
  entity_id     UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, entity_id)
);

CREATE INDEX user_collection_user_workspace_name_idx
  ON user_collection(user_id, workspace, name, created_at);

CREATE INDEX user_collection_entity_entity_idx
  ON user_collection_entity(entity_id);
