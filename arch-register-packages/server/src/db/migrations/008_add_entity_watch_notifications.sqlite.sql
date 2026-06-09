-- @creates user_watch
CREATE TABLE user_watch (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, workspace, entity_id)
);

CREATE INDEX user_watch_workspace_entity_idx ON user_watch(workspace, entity_id);

-- @creates user_notification
CREATE TABLE user_notification (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    audit_log_id TEXT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    entity_name TEXT NOT NULL,
    entity_slug TEXT NOT NULL,
    schema_id TEXT,
    changed_by_user_id TEXT NOT NULL,
    changed_by_display_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, audit_log_id)
);

CREATE INDEX user_notification_user_workspace_timestamp_idx
    ON user_notification(user_id, workspace, timestamp DESC);
