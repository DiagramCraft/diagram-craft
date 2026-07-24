-- @creates user_inbox_notification
CREATE TABLE user_inbox_notification (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace             UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  category              TEXT NOT NULL CHECK (category IN ('information', 'action')),
  event_type            TEXT NOT NULL,
  resource_type         TEXT NOT NULL,
  resource_id           UUID NOT NULL,
  case_id               UUID REFERENCES governance_case(id) ON DELETE CASCADE,
  assignment_id         UUID REFERENCES governance_assignment(id) ON DELETE CASCADE,
  actor_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_display_name    TEXT,
  title                 TEXT NOT NULL,
  message               TEXT NOT NULL,
  action_route          TEXT,
  presentation_metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at           TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at               TIMESTAMPTZ,
  delivery_key          TEXT NOT NULL,
  UNIQUE (user_id, delivery_key)
);

CREATE INDEX user_inbox_notification_user_workspace_occurred_idx
  ON user_inbox_notification(user_id, workspace, occurred_at DESC, created_at DESC);

CREATE INDEX user_inbox_notification_unread_idx
  ON user_inbox_notification(user_id, workspace, read_at);
