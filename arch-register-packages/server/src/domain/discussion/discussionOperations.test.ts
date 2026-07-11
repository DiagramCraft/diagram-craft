import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DiscussionPostDbResult } from './db/discussionDatabase';
import {
  createDiscussionPost,
  deleteDiscussionPost,
  listDiscussionPosts,
  summarizeDiscussions,
  updateDiscussionPost
} from './discussionOperations';

const authCtxMock = {
  userId: 'user-1',
  globalPermissions: new Set(['admin_platform']),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamRolesByTeam: new Map(),
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => authCtxMock),
  requireWorkspaceCapability: vi.fn(),
  requireEntityAction: vi.fn(),
  requireProjectAccess: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'new-post-id'
}));

import { requireEntityAction, requireProjectAccess, requireWorkspaceCapability } from '../auth/authorization';

const now = new Date('2026-06-01T12:00:00.000Z');
const later = new Date('2026-06-02T12:00:00.000Z');

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;
const otherUserEvent = { context: { user: { id: 'user-2' } } } as unknown as AuthenticatedEvent;

const makePost = (overrides: Partial<DiscussionPostDbResult> = {}): DiscussionPostDbResult => ({
  id: 'post-1',
  workspace: 'ws-1',
  object_type: 'entity',
  object_id: 'entity-1',
  parent_post_id: null,
  author_id: 'user-1',
  body: 'Hello',
  created_at: now,
  updated_at: now,
  edited_at: null,
  ...overrides
});

const makeDb = (overrides: Record<string, unknown> = {}): DatabaseAdapter =>
  ({
    catalog: {
      getEntity: vi.fn(async () => ({
        id: 'entity-1',
        workspace: 'ws-1',
        name: 'Checkout Service',
        public_id: 'entity-1-public'
      }))
    },
    project: {
      getAnyContentNodeById: vi.fn(async () => ({
        id: 'node-1',
        workspace: 'ws-1',
        name: 'Runbook',
        project_id: 'proj-1',
        project_public_id: 'proj-1-public',
        entity_id: null
      })),
      getAssessmentById: vi.fn(async () => ({
        id: 'asmnt-1',
        workspace: 'ws-1',
        project_id: 'proj-1',
        name: 'Security Readiness'
      })),
      getProject: vi.fn(async () => ({ id: 'proj-1', owner: null, public_id: 'proj-1-public' }))
    },
    auth: {
      listUsers: vi.fn(async () => [{ id: 'user-1', display_name: 'User One' }])
    },
    discussion: {
      listByObject: vi.fn(async () => [makePost()]),
      listAll: vi.fn(async () => [makePost()]),
      getPost: vi.fn(async () => makePost()),
      createPost: vi.fn(async () => makePost()),
      updatePost: vi.fn(async () => makePost({ body: 'Updated', edited_at: later, updated_at: later })),
      deletePost: vi.fn(async () => makePost())
    },
    ...overrides
  }) as unknown as DatabaseAdapter;

describe('listDiscussionPosts', () => {
  it('resolves entity visibility and returns posts with author names', async () => {
    const db = makeDb();
    const result = await listDiscussionPosts(db, 'ws-1', 'entity', 'entity-1', event);

    expect(requireEntityAction).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]!.authorName).toBe('User One');
    expect(result[0]!.authorId).toBe('user-1');
  });

  it('checks project access for content_node objects that belong to a project', async () => {
    const db = makeDb();
    await listDiscussionPosts(db, 'ws-1', 'content_node', 'node-1', event);
    expect(requireProjectAccess).toHaveBeenCalledWith(authCtxMock, null, expect.any(String));
  });

  it('checks content.view for content_node objects with no owning project', async () => {
    const db = makeDb({
      project: {
        getAnyContentNodeById: vi.fn(async () => ({
          id: 'node-2',
          workspace: 'ws-1',
          name: 'Workspace page',
          project_id: null,
          project_public_id: null,
          entity_id: null
        }))
      }
    });
    await listDiscussionPosts(db, 'ws-1', 'content_node', 'node-2', event);
    expect(requireWorkspaceCapability).toHaveBeenCalledWith(
      authCtxMock,
      'content.view',
      expect.any(String)
    );
  });

  it('checks project access for assessment objects', async () => {
    const db = makeDb();
    await listDiscussionPosts(db, 'ws-1', 'assessment', 'asmnt-1', event);
    expect(requireProjectAccess).toHaveBeenCalled();
  });

  it('throws 404 when the object does not exist', async () => {
    const db = makeDb({
      catalog: { getEntity: vi.fn(async () => null) }
    });

    await expect(listDiscussionPosts(db, 'ws-1', 'entity', 'missing', event)).rejects.toMatchObject({
      status: 404
    });
  });

  it('falls back to a placeholder name when the author was deleted', async () => {
    const db = makeDb({
      discussion: {
        listByObject: vi.fn(async () => [makePost({ author_id: null })])
      }
    });

    const result = await listDiscussionPosts(db, 'ws-1', 'entity', 'entity-1', event);
    expect(result[0]!.authorId).toBeNull();
    expect(result[0]!.authorName).toBe('Unknown user');
  });
});

describe('createDiscussionPost', () => {
  it('creates a root post and requires the comments capability', async () => {
    const db = makeDb();
    const result = await createDiscussionPost(
      db,
      'ws-1',
      { objectType: 'entity', objectId: 'entity-1', body: 'New topic' },
      event
    );

    expect(requireWorkspaceCapability).toHaveBeenCalledWith(authCtxMock, 'comments', expect.any(String));
    expect(db.discussion.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-post-id',
        object_type: 'entity',
        object_id: 'entity-1',
        author_id: 'user-1',
        parent_post_id: null
      })
    );
    expect(result.id).toBe('post-1');
  });

  it('rejects a reply whose parent belongs to a different object', async () => {
    const db = makeDb({
      discussion: {
        getPost: vi.fn(async () => makePost({ object_type: 'entity', object_id: 'other-entity' }))
      }
    });

    await expect(
      createDiscussionPost(
        db,
        'ws-1',
        { objectType: 'entity', objectId: 'entity-1', parentPostId: 'post-1', body: 'Reply' },
        event
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a reply whose parent is itself a reply', async () => {
    const db = makeDb({
      discussion: {
        getPost: vi.fn(async () => makePost({ id: 'reply-1', parent_post_id: 'root-1' }))
      }
    });

    await expect(
      createDiscussionPost(
        db,
        'ws-1',
        { objectType: 'entity', objectId: 'entity-1', parentPostId: 'reply-1', body: 'Reply' },
        event
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(db.discussion.createPost).not.toHaveBeenCalled();
  });

  it('404s when replying to a post that does not exist', async () => {
    const db = makeDb({
      discussion: { getPost: vi.fn(async () => null) }
    });

    await expect(
      createDiscussionPost(
        db,
        'ws-1',
        { objectType: 'entity', objectId: 'entity-1', parentPostId: 'missing', body: 'Reply' },
        event
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateDiscussionPost', () => {
  it('allows the author to edit their own post', async () => {
    const db = makeDb();
    const result = await updateDiscussionPost(db, 'ws-1', 'post-1', { body: 'Updated' }, event);

    expect(result.body).toBe('Updated');
    expect(result.editedAt).not.toBeNull();
  });

  it('rejects edits from a different user', async () => {
    const db = makeDb();

    await expect(
      updateDiscussionPost(db, 'ws-1', 'post-1', { body: 'Hacked' }, otherUserEvent)
    ).rejects.toMatchObject({ status: 403 });
    expect(db.discussion.updatePost).not.toHaveBeenCalled();
  });

  it('404s when the post does not exist', async () => {
    const db = makeDb({ discussion: { getPost: vi.fn(async () => null) } });

    await expect(
      updateDiscussionPost(db, 'ws-1', 'missing', { body: 'x' }, event)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteDiscussionPost', () => {
  it('allows the author to delete their own post', async () => {
    const db = makeDb();
    const result = await deleteDiscussionPost(db, 'ws-1', 'post-1', event);

    expect(result.success).toBe(true);
    expect(db.discussion.deletePost).toHaveBeenCalledWith('ws-1', 'post-1');
  });

  it('rejects deletes from a different user', async () => {
    const db = makeDb();

    await expect(deleteDiscussionPost(db, 'ws-1', 'post-1', otherUserEvent)).rejects.toMatchObject({
      status: 403
    });
    expect(db.discussion.deletePost).not.toHaveBeenCalled();
  });
});

describe('summarizeDiscussions', () => {
  it('groups posts by object and picks the most recent as lastPost', async () => {
    const db = makeDb({
      discussion: {
        listAll: vi.fn(async () => [
          makePost({ id: 'p1', created_at: now }),
          makePost({ id: 'p2', created_at: later, body: 'Second' })
        ])
      }
    });

    const result = await summarizeDiscussions(db, 'ws-1', event);
    expect(result).toHaveLength(1);
    expect(result[0]!.postCount).toBe(2);
    expect(result[0]!.lastPost.id).toBe('p2');
    expect(result[0]!.objectTitle).toBe('Checkout Service');
    expect(result[0]!.nav).toEqual({ type: 'entity', entityPublicId: 'entity-1-public' });
  });

  it('skips objects the caller cannot see', async () => {
    const db = makeDb({
      discussion: {
        listAll: vi.fn(async () => [makePost({ object_type: 'entity', object_id: 'entity-1' })])
      },
      catalog: {
        getEntity: vi.fn(async () => null)
      }
    });

    const result = await summarizeDiscussions(db, 'ws-1', event);
    expect(result).toHaveLength(0);
  });
});
