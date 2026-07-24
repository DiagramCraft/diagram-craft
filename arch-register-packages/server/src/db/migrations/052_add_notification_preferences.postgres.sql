-- @creates user_notification_preference
CREATE TABLE user_notification_preference (
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace         UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel           TEXT NOT NULL,
  enabled           BOOLEAN NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace, notification_type, channel)
);
