-- @creates user_inbox_notification
CREATE TABLE user_inbox_notification (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace             TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  category              TEXT NOT NULL CHECK (category IN ('information', 'action')),
  event_type            TEXT NOT NULL,
  resource_type         TEXT NOT NULL,
  resource_id           TEXT NOT NULL,
  case_id               TEXT REFERENCES governance_case(id) ON DELETE CASCADE,
  assignment_id         TEXT REFERENCES governance_assignment(id) ON DELETE CASCADE,
  actor_user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_display_name    TEXT,
  title                 TEXT NOT NULL,
  message               TEXT NOT NULL,
  action_route          TEXT,
  presentation_metadata TEXT NOT NULL DEFAULT '{}',
  occurred_at           TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  read_at               TEXT,
  delivery_key          TEXT NOT NULL,
  UNIQUE (user_id, delivery_key)
);

CREATE INDEX user_inbox_notification_user_workspace_occurred_idx
  ON user_inbox_notification(user_id, workspace, occurred_at DESC, created_at DESC);

CREATE INDEX user_inbox_notification_unread_idx
  ON user_inbox_notification(user_id, workspace, read_at);
