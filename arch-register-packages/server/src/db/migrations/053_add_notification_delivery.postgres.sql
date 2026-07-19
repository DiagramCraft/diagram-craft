-- @creates notification_delivery
ALTER TABLE user_inbox_notification
  ADD COLUMN in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE notification_delivery (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id       UUID NOT NULL REFERENCES user_inbox_notification(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace             UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  channel               TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'sms')),
  status                TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  recipient_email       TEXT NOT NULL,
  provider              TEXT,
  provider_message_id   TEXT,
  attempt_count         INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts          INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at       TIMESTAMPTZ NOT NULL,
  locked_until          TIMESTAMPTZ,
  lease_token           UUID,
  last_error            TEXT,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, channel)
);

CREATE INDEX notification_delivery_pending_idx
  ON notification_delivery(workspace, status, next_attempt_at);
CREATE INDEX notification_delivery_notification_idx
  ON notification_delivery(notification_id);
