import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { buildUserAuthCtx } from '../auth/authorization';
import type { Entity } from '../catalog/db/catalogDatabase';
import type { ContentNodeDbResult } from '../project/db/projectDatabase';
import { isChannelEnabled } from './notificationPreferences';

export type CommentNotificationObjectType = 'entity' | 'content_node';
export type CommentNotificationSurface = 'discussion' | 'inline';

export type CommentNotificationMetadata = {
  objectType: CommentNotificationObjectType;
  objectId: string;
  commentSurface: CommentNotificationSurface;
  entityId?: string | null;
  projectId?: string | null;
};

export type CreateCommentNotificationsInput = {
  workspace: string;
  commentId: string;
  objectType: CommentNotificationObjectType;
  objectId: string;
  commentSurface: CommentNotificationSurface;
  parentPostId: string | null;
  parentAuthorId: string | null;
  actorUserId: string;
  occurredAt: Date;
};

const checker = new PermissionChecker();

const encode = (value: string) => encodeURIComponent(value);

const isUserActive = (user: { is_active?: boolean }) => user.is_active !== false;

const buildActionRoute = (
  target: {
    entity?: Entity | null;
    node?: ContentNodeDbResult | null;
    project?: { id: string; public_id?: string | null } | null;
  },
  surface: CommentNotificationSurface,
  commentId: string
) => {
  if (target.node) {
    const route = target.entity
      ? `/entities/${encode(target.entity.public_id ?? target.entity.id)}/wiki/${encode(target.node.id)}`
      : target.project
        ? `/projects/${encode(target.project.public_id ?? target.project.id)}/wiki/${encode(target.node.id)}`
        : `/content/wiki/${encode(target.node.id)}`;
    return surface === 'inline' ? `${route}?commentId=${encode(commentId)}` : route;
  }

  if (!target.entity) return null;
  return `/entities/${encode(target.entity.public_id ?? target.entity.id)}?tab=discussions`;
};

const canViewTarget = async (
  authCtx: AuthorizationContext,
  target: {
    objectType: CommentNotificationObjectType;
    entity?: Entity | null;
    node?: ContentNodeDbResult | null;
    project?: { owner: string | null } | null;
  }
) => {
  if (target.objectType === 'entity') {
    return (
      target.entity != null && checker.hasEntityPermission(authCtx, target.entity, 'view_entity')
    );
  }

  if (!target.node) return false;
  if (target.node.project_id) {
    return (
      target.project != null &&
      checker.hasProjectPermission(authCtx, target.project.owner, 'edit_project')
    );
  }
  return checker.hasWorkspaceCapability(authCtx, 'content.view');
};

const resolveTarget = async (
  db: DatabaseAdapter,
  workspace: string,
  input: CreateCommentNotificationsInput
) => {
  if (input.objectType === 'entity') {
    const entity = await db.catalog.getEntity(workspace, input.objectId);
    return { entity, node: null, project: null, title: entity?.name ?? input.objectId };
  }

  const node = await db.project.getAnyContentNodeById(workspace, input.objectId);
  const project = node?.project_id ? await db.project.getProject(workspace, node.project_id) : null;
  const entity = node?.entity_id ? await db.catalog.getEntity(workspace, node.entity_id) : null;
  return { entity, node, project, title: node?.name ?? input.objectId };
};

const addOwnerRecipients = async (
  db: DatabaseAdapter,
  workspace: string,
  entity: Entity | null | undefined,
  recipients: Set<string>
) => {
  if (!entity?.owner || !db.workspace?.listTeamAssignments) return;
  const assignments = await db.workspace.listTeamAssignments(workspace);
  for (const assignment of assignments) {
    if (assignment.team_id === entity.owner) recipients.add(assignment.user_id);
  }
};

/** Creates in-app notifications for a newly-created discussion or inline comment. */
export const createCommentNotifications = async (
  db: DatabaseAdapter,
  input: CreateCommentNotificationsInput
): Promise<void> => {
  // Focused domain tests use deliberately partial database doubles. Production adapters always
  // expose these services; retaining a no-op here keeps comment persistence tests isolated.
  if (!db.notification || !db.auth?.listUsers) return;

  const target = await resolveTarget(db, input.workspace, input);
  if (input.objectType === 'entity' && !target.entity) return;
  if (input.objectType === 'content_node' && !target.node) return;

  const users = await db.auth.listUsers();
  const usersById = new Map(users.map(user => [user.id, user]));
  const recipients = new Set<string>();

  const isReply = input.parentPostId != null;
  if (isReply) {
    if (input.parentAuthorId) recipients.add(input.parentAuthorId);
  } else {
    if (input.objectType === 'entity') {
      await addOwnerRecipients(db, input.workspace, target.entity, recipients);
    } else {
      if (target.node?.created_by) recipients.add(target.node.created_by);
      await addOwnerRecipients(db, input.workspace, target.entity, recipients);
    }
  }

  recipients.delete(input.actorUserId);
  if (recipients.size === 0) return;

  const actionRoute = buildActionRoute(target, input.commentSurface, input.commentId);
  if (!actionRoute) return;

  const actorDisplayName = usersById.get(input.actorUserId)?.display_name ?? input.actorUserId;
  const eventType = isReply ? 'comment.replied' : 'comment.created';
  const message = isReply
    ? `${actorDisplayName} replied to your comment on ${target.title}`
    : `${actorDisplayName} commented on ${target.title}`;
  const metadata: CommentNotificationMetadata = {
    objectType: input.objectType,
    objectId: input.objectId,
    commentSurface: input.commentSurface,
    entityId: target.entity?.id ?? target.node?.entity_id ?? null,
    projectId: target.node?.project_id ?? null
  };

  for (const recipientId of recipients) {
    const recipient = usersById.get(recipientId);
    if (!recipient || !isUserActive(recipient)) continue;

    const authCtx = await buildUserAuthCtx(db, input.workspace, recipientId);
    if (!(await canViewTarget(authCtx, { ...target, objectType: input.objectType }))) continue;
    if (!(await isChannelEnabled(db, recipientId, input.workspace, 'comment-activity', 'in_app'))) {
      continue;
    }

    await db.notification.createNotification({
      id: randomUUID(),
      user_id: recipientId,
      workspace: input.workspace,
      category: 'information',
      event_type: eventType,
      resource_type: 'comment',
      resource_id: input.commentId,
      case_id: null,
      assignment_id: null,
      actor_user_id: input.actorUserId,
      actor_display_name: actorDisplayName,
      title: target.title,
      message,
      action_route: actionRoute,
      presentation_metadata: metadata,
      occurred_at: input.occurredAt,
      delivery_key: `comment-activity:${input.commentId}:user:${recipientId}`,
      in_app_enabled: true
    });
  }
};

export const isCommentNotification = (notification: { resource_type: string }) =>
  notification.resource_type === 'comment';

/** Re-checks the current viewer's access before a stored comment notification is returned. */
export const canAccessCommentNotification = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  metadata: Record<string, unknown>,
  entityMap: Map<string, Entity>
) => {
  const objectType = metadata.objectType;
  const objectId = metadata.objectId;
  if ((objectType !== 'entity' && objectType !== 'content_node') || typeof objectId !== 'string') {
    return false;
  }

  if (objectType === 'entity') {
    return canViewTarget(authCtx, {
      objectType,
      entity: entityMap.get(objectId) ?? null
    });
  }

  const node = await db.project.getAnyContentNodeById(workspace, objectId);
  if (!node) return false;
  const project = node.project_id ? await db.project.getProject(workspace, node.project_id) : null;
  return canViewTarget(authCtx, { objectType, node, project });
};
