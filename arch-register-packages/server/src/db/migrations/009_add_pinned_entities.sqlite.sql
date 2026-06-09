-- @creates user_pinned_entity
CREATE TABLE user_pinned_entity (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, workspace, entity_id)
);

CREATE INDEX user_pinned_entity_user_workspace_created_idx
    ON user_pinned_entity(user_id, workspace, created_at DESC);

CREATE INDEX user_pinned_entity_workspace_entity_idx
    ON user_pinned_entity(workspace, entity_id);
