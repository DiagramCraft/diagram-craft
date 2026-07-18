-- @creates user_notification_preference
CREATE TABLE user_notification_preference (
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace         TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel           TEXT NOT NULL,
  enabled           INTEGER NOT NULL,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, workspace, notification_type, channel)
);
