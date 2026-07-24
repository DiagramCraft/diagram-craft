-- @creates notification_delivery
ALTER TABLE user_inbox_notification ADD COLUMN in_app_enabled INTEGER NOT NULL DEFAULT 1;

CREATE TABLE notification_delivery (
  id                    TEXT PRIMARY KEY,
  notification_id       TEXT NOT NULL REFERENCES user_inbox_notification(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace             TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  channel               TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'sms')),
  status                TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  recipient_email       TEXT NOT NULL,
  provider              TEXT,
  provider_message_id   TEXT,
  attempt_count         INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts          INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at       TEXT NOT NULL,
  locked_until          TEXT,
  lease_token           TEXT,
  last_error            TEXT,
  sent_at               TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (notification_id, channel)
);

CREATE INDEX notification_delivery_pending_idx
  ON notification_delivery(workspace, status, next_attempt_at);
CREATE INDEX notification_delivery_notification_idx
  ON notification_delivery(notification_id);
