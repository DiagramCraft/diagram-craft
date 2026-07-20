import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { canAccessCommentNotification, createCommentNotifications } from './commentNotifications';

const adminAuthCtx: AuthorizationContext = {
  userId: 'recipient-1',
  globalRoles: new Set(),
  globalPermissions: new Set(['admin_platform']),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamIds: new Set(),
  teamAssignments: [],
  teams: [],
  teamRolesByTeam: new Map(),
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

vi.mock('../auth/authorization', () => ({
  buildUserAuthCtx: vi.fn(async () => adminAuthCtx)
}));

const makeEntity = (overrides: Record<string, unknown> = {}) => ({
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'entity-1-public',
  slug: 'entity-1',
  namespace: '',
  name: 'Checkout Service',
  description: '',
  owner: 'team-platform',
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  visibility_mode: 'public' as const,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

const makeDb = (overrides: Record<string, unknown> = {}) =>
  ({
    auth: {
      listUsers: vi.fn(async () => [
        { id: 'actor-1', display_name: 'Actor', is_active: true },
        { id: 'recipient-1', display_name: 'Owner One', is_active: true },
        { id: 'recipient-2', display_name: 'Owner Two', is_active: true }
      ])
    },
    workspace: {
      listTeamAssignments: vi.fn(async () => [
        { workspace: 'ws-1', team_id: 'team-platform', user_id: 'recipient-1' },
        { workspace: 'ws-1', team_id: 'team-platform', user_id: 'recipient-2' }
      ])
    },
    catalog: {
      getEntity: vi.fn(async () => makeEntity())
    },
    project: {
      getAnyContentNodeById: vi.fn(async () => null),
      getProject: vi.fn(async () => null)
    },
    notificationPreference: {
      listOverrides: vi.fn(async () => [])
    },
    notification: {
      createNotification: vi.fn(async input => input)
    },
    ...overrides
  }) as unknown as DatabaseAdapter;

describe('createCommentNotifications', () => {
  it('notifies every owner-team member once and excludes the commenter', async () => {
    const db = makeDb();

    await createCommentNotifications(db, {
      workspace: 'ws-1',
      commentId: 'comment-1',
      objectType: 'entity',
      objectId: 'entity-1',
      commentSurface: 'discussion',
      parentPostId: null,
      parentAuthorId: null,
      actorUserId: 'actor-1',
      occurredAt: new Date('2026-07-19T12:00:00.000Z')
    });

    const notifications = (db.notification.createNotification as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(notifications).toHaveLength(2);
    expect(notifications.map(([input]) => input.user_id)).toEqual(['recipient-1', 'recipient-2']);
    expect(notifications[0]![0]).toMatchObject({
      event_type: 'comment.created',
      resource_type: 'comment',
      resource_id: 'comment-1',
      action_route: '/entities/entity-1-public?tab=discussions'
    });
  });

  it('deduplicates a content author who is also an entity-owner recipient', async () => {
    const db = makeDb({
      project: {
        getAnyContentNodeById: vi.fn(async () => ({
          id: 'node-1',
          workspace: 'ws-1',
          project_id: null,
          entity_id: 'entity-1',
          name: 'Runbook',
          created_by: 'recipient-1'
        })),
        getProject: vi.fn(async () => null)
      }
    });

    await createCommentNotifications(db, {
      workspace: 'ws-1',
      commentId: 'comment-2',
      objectType: 'content_node',
      objectId: 'node-1',
      commentSurface: 'inline',
      parentPostId: null,
      parentAuthorId: null,
      actorUserId: 'actor-1',
      occurredAt: new Date()
    });

    const notifications = (db.notification.createNotification as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(notifications).toHaveLength(2);
    expect(notifications.map(([input]) => input.user_id)).toEqual(['recipient-1', 'recipient-2']);
    expect(notifications[0]![0].action_route).toBe(
      '/entities/entity-1-public/wiki/node-1?commentId=comment-2'
    );
  });

  it('notifies only the parent author for a reply', async () => {
    const db = makeDb();

    await createCommentNotifications(db, {
      workspace: 'ws-1',
      commentId: 'reply-1',
      objectType: 'entity',
      objectId: 'entity-1',
      commentSurface: 'discussion',
      parentPostId: 'comment-1',
      parentAuthorId: 'recipient-1',
      actorUserId: 'actor-1',
      occurredAt: new Date()
    });

    const notifications = (db.notification.createNotification as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]![0]).toMatchObject({
      user_id: 'recipient-1',
      event_type: 'comment.replied'
    });
  });

  it('does not fall back to object recipients when a deleted parent author replies', async () => {
    const db = makeDb();

    await createCommentNotifications(db, {
      workspace: 'ws-1',
      commentId: 'reply-2',
      objectType: 'entity',
      objectId: 'entity-1',
      commentSurface: 'discussion',
      parentPostId: 'deleted-root',
      parentAuthorId: null,
      actorUserId: 'actor-1',
      occurredAt: new Date()
    });

    expect(db.notification.createNotification).not.toHaveBeenCalled();
  });
});

describe('canAccessCommentNotification', () => {
  it('uses stored target metadata to re-check entity visibility', async () => {
    const db = makeDb();
    const entityMap = new Map([['entity-1', makeEntity()]]);

    await expect(
      canAccessCommentNotification(
        db,
        'ws-1',
        adminAuthCtx,
        { objectType: 'entity', objectId: 'entity-1' },
        entityMap
      )
    ).resolves.toBe(true);
  });
});
