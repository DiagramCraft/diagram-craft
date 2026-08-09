import type { DatabaseAdapter } from '../../db/database';
import type { AuditLogDbResult } from './db/auditDatabase';
import { buildUserAuthCtxs } from '../auth/authorization';
import { canViewRelationNotification } from '../catalog/relationNotificationAccess';
import { NOTIFICATION_TYPE_CATALOG } from '../notification/notificationPreferenceCatalog';

type WatcherRecipient = {
  userId: string;
  email: string | null;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  relationVisible?: boolean;
};

const relationEndpointIds = (auditLog: AuditLogDbResult) => {
  const relation = auditLog.metadata['relation'];
  if (auditLog.entity_type !== 'relation' || typeof relation !== 'object' || relation == null) {
    return [];
  }
  return [
    (relation as { in?: { id?: unknown } }).in?.id,
    (relation as { out?: { id?: unknown } }).out?.id
  ].filter((id): id is string => typeof id === 'string');
};

const enabled = (
  overrides: Map<string, Map<string, boolean>>,
  userId: string,
  channel: 'in_app' | 'email'
) =>
  overrides.get(userId)?.get(`entity-watch-activity:${channel}`) ??
  NOTIFICATION_TYPE_CATALOG['entity-watch-activity'].defaultChannels.includes(channel);

const resolveRecipients = async (
  db: DatabaseAdapter,
  auditLog: AuditLogDbResult,
  watchedEntityIds: string[],
  explicitWatcherUserIds?: string[]
): Promise<WatcherRecipient[]> => {
  const watcherRows = explicitWatcherUserIds
    ? []
    : await db.watch.listWatcherUserIdsForEntities(auditLog.workspace, watchedEntityIds);
  const userIds = [
    ...new Set(explicitWatcherUserIds ?? watcherRows.map(row => row.user_id))
  ].filter(userId => userId !== auditLog.user_id);
  if (userIds.length === 0) return [];

  const [users, preferences] = await Promise.all([
    db.auth.listUsersByIds(userIds),
    db.notificationPreference.listOverridesForUsers(userIds, auditLog.workspace)
  ]);
  const usersById = new Map(users.map(user => [user.id, user]));
  const overrides = new Map<string, Map<string, boolean>>();
  for (const preference of preferences) {
    const userOverrides = overrides.get(preference.user_id) ?? new Map<string, boolean>();
    userOverrides.set(
      `${preference.notification_type}:${preference.channel}`,
      preference.enabled
    );
    overrides.set(preference.user_id, userOverrides);
  }

  return userIds
    .map(userId => {
      const user = usersById.get(userId);
      const inAppEnabled = enabled(overrides, userId, 'in_app');
      const emailEnabled = user?.email != null && enabled(overrides, userId, 'email');
      return inAppEnabled || emailEnabled
        ? {
            userId,
            email: user?.email ?? null,
            inAppEnabled,
            emailEnabled
          }
        : null;
    })
    .filter((recipient): recipient is WatcherRecipient => recipient != null);
};

export const createAuditWatcherNotifications = async (
  db: DatabaseAdapter,
  auditLog: AuditLogDbResult,
  explicitWatcherUserIds?: string[]
) => {
  const endpointIds = relationEndpointIds(auditLog);
  const watchedEntityIds =
    auditLog.entity_type === 'relation' ? endpointIds : [auditLog.entity_id];
  let recipients = await resolveRecipients(
    db,
    auditLog,
    watchedEntityIds,
    explicitWatcherUserIds
  );

  if (auditLog.entity_type === 'relation') {
    const relation = await db.relation.getRelation(auditLog.workspace, auditLog.entity_id);
    const ownerFromAudit = [auditLog.changes.new, auditLog.changes.old]
      .map(changes => changes?.['_owner'])
      .find((owner): owner is string | null => owner === null || typeof owner === 'string');
    const owner = relation?.owner ?? ownerFromAudit ?? null;
    const contexts = await buildUserAuthCtxs(
      db,
      auditLog.workspace,
      recipients.map(recipient => recipient.userId)
    );
    recipients = (
      await Promise.all(
        recipients.map(async recipient => {
          const authCtx = contexts.get(recipient.userId);
          if (!authCtx || !auditLog.schema_id || !endpointIds[0] || !endpointIds[1]) return null;
          try {
            const visible = await canViewRelationNotification(
              db,
              auditLog.workspace,
              authCtx,
              {
                relationSchemaId: auditLog.schema_id,
                inEntityId: endpointIds[0],
                outEntityId: endpointIds[1],
                at: auditLog.timestamp,
                owner
              }
            );
            return visible ? { ...recipient, relationVisible: true } : null;
          } catch {
            return null;
          }
        })
      )
    ).filter((recipient): recipient is Exclude<typeof recipient, null> => recipient != null);
  }

  await db.watch.createNotificationsFromAudit({
    auditLog,
    changedByDisplayName: auditLog.user_display_name ?? auditLog.user_id ?? 'system',
    watchedEntityIds,
    watcherRecipients: recipients
  });
};
