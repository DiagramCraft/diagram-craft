-- @creates user_watch
CREATE TABLE user_watch (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, workspace, entity_id)
);

CREATE INDEX user_watch_workspace_entity_idx ON user_watch(workspace, entity_id);

-- @creates user_notification
CREATE TABLE user_notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    audit_log_id UUID NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    entity_name TEXT NOT NULL,
    entity_slug TEXT NOT NULL,
    schema_id UUID,
    changed_by_user_id UUID NOT NULL,
    changed_by_display_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, audit_log_id)
);

CREATE INDEX user_notification_user_workspace_timestamp_idx
    ON user_notification(user_id, workspace, timestamp DESC);
