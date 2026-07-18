-- Entity-watch notifications now flow through the generic user_inbox_notification table
-- (see 046_add_inbox_notifications) alongside governance notifications, so the legacy
-- per-feature table and its unique constraint are no longer needed.
DROP TABLE IF EXISTS user_notification;
