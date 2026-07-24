import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type InboxNotificationCategory = 'information' | 'action';

export type InboxNotificationDbResult = {
  id: string;
  user_id: string;
  workspace: string;
  category: InboxNotificationCategory;
  event_type: string;
  resource_type: string;
  resource_id: string;
  case_id: string | null;
  assignment_id: string | null;
  actor_user_id: string | null;
  actor_display_name: string | null;
  title: string;
  message: string;
  action_route: string | null;
  presentation_metadata: Record<string, unknown>;
  occurred_at: Date;
  created_at: Date;
  read_at: Date | null;
  delivery_key: string;
  in_app_enabled: boolean;
};

export type InboxNotificationDbCreate = Omit<
  InboxNotificationDbResult,
  'created_at' | 'read_at' | 'in_app_enabled'
> & {
  created_at?: Date;
  read_at?: Date | null;
  in_app_enabled?: boolean;
};

export const notificationMappers = {
  notification: (row: DatabaseRow): InboxNotificationDbResult => ({
    id: String(row['id']),
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    category: row['category'] as InboxNotificationCategory,
    event_type: String(row['event_type']),
    resource_type: String(row['resource_type']),
    resource_id: String(row['resource_id']),
    case_id: row['case_id'] == null ? null : String(row['case_id']),
    assignment_id: row['assignment_id'] == null ? null : String(row['assignment_id']),
    actor_user_id: row['actor_user_id'] == null ? null : String(row['actor_user_id']),
    actor_display_name:
      row['actor_display_name'] == null ? null : String(row['actor_display_name']),
    title: String(row['title']),
    message: String(row['message']),
    action_route: row['action_route'] == null ? null : String(row['action_route']),
    presentation_metadata: parseDatabaseJson(
      row['presentation_metadata'],
      {},
      'user_inbox_notification.presentation_metadata'
    ),
    occurred_at: databaseDate(row['occurred_at']),
    created_at: databaseDate(row['created_at']),
    read_at: row['read_at'] == null ? null : databaseDate(row['read_at']),
    delivery_key: String(row['delivery_key']),
    in_app_enabled: row['in_app_enabled'] == null ? true : databaseBoolean(row['in_app_enabled'])
  })
};

export type NotificationDatabase = {
  listNotifications(userId: string, workspace: string): Promise<InboxNotificationDbResult[]>;
  getNotification(id: string): Promise<InboxNotificationDbResult | null>;
  countUnread(userId: string, workspace: string): Promise<number>;
  markRead(userId: string, workspace: string, id: string, readAt: Date): Promise<boolean>;
  markAllRead(userId: string, workspace: string, readAt: Date): Promise<number>;
  /**
   * Marks unread notifications tied to any of the given governance assignments as read. Used to
   * clear a user's notification the moment their action item is resolved, independent of whether
   * they ever open the bell.
   */
  markReadByAssignmentIds(assignmentIds: string[], readAt: Date): Promise<number>;
  /**
   * Marks unread notifications tied to any of the given governance cases as read. Informational
   * notifications (assigned, approved, rejected, etc.) carry a case_id but no assignment_id, so
   * they are not caught by `markReadByAssignmentIds`; this clears them once the case they belong
   * to is fully resolved, since nothing about it remains actionable at that point.
   */
  markReadByCaseIds(caseIds: string[], readAt: Date): Promise<number>;
  createNotification(input: InboxNotificationDbCreate): Promise<InboxNotificationDbResult>;
};
