import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { WikiCommentDbResult } from './db/wikiCommentDatabase';
import {
  createWikiComment,
  deleteWikiComment,
  listWikiComments,
  resolveWikiComment,
  updateWikiComment
} from './wikiCommentOperations';

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
  requireProjectAccess: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'new-comment-id'
}));

import { requireProjectAccess, requireWorkspaceCapability } from '../auth/authorization';

const now = new Date('2026-06-01T12:00:00.000Z');
const later = new Date('2026-06-02T12:00:00.000Z');

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;
const otherUserEvent = { context: { user: { id: 'user-2' } } } as unknown as AuthenticatedEvent;

const makeComment = (overrides: Partial<WikiCommentDbResult> = {}): WikiCommentDbResult => ({
  id: 'comment-1',
  workspace: 'ws-1',
  node_id: 'node-1',
  parent_post_id: null,
  author_id: 'user-1',
  body: 'Hello',
  quote: 'the quoted text',
  prefix: 'before ',
  suffix: ' after',
  anchor_start: 10,
  anchor_end: 26,
  resolved_at: null,
  resolved_by: null,
  created_at: now,
  updated_at: now,
  edited_at: null,
  ...overrides
});

const makeDb = (overrides: Record<string, unknown> = {}): DatabaseAdapter =>
  ({
    project: {
      getAnyContentNodeById: vi.fn(async () => ({
        id: 'node-1',
        workspace: 'ws-1',
        name: 'Runbook',
        project_id: 'proj-1',
        project_public_id: 'proj-1-public',
        entity_id: null
      })),
      getProject: vi.fn(async () => ({ id: 'proj-1', owner: null, public_id: 'proj-1-public' }))
    },
    auth: {
      listUsers: vi.fn(async () => [{ id: 'user-1', display_name: 'User One' }])
    },
    wikiComment: {
      listByNode: vi.fn(async () => [makeComment()]),
      getPost: vi.fn(async () => makeComment()),
      createPost: vi.fn(async () => makeComment()),
      updatePost: vi.fn(async () =>
        makeComment({ body: 'Updated', edited_at: later, updated_at: later })
      ),
      setResolved: vi.fn(async () =>
        makeComment({ resolved_at: later, resolved_by: 'user-1', updated_at: later })
      ),
      deletePost: vi.fn(async () => makeComment())
    },
    ...overrides
  }) as unknown as DatabaseAdapter;

describe('listWikiComments', () => {
  it('checks project access for a page belonging to a project', async () => {
    const db = makeDb();
    const result = await listWikiComments(db, 'ws-1', 'node-1', event);

    expect(requireProjectAccess).toHaveBeenCalledWith(authCtxMock, null, expect.any(String));
    expect(result).toHaveLength(1);
    expect(result[0]!.authorName).toBe('User One');
    expect(result[0]!.anchor).toEqual({
      quote: 'the quoted text',
      prefix: 'before ',
      suffix: ' after',
      start: 10,
      end: 26
    });
  });

  it('checks content.view for pages with no owning project', async () => {
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
    await listWikiComments(db, 'ws-1', 'node-2', event);
    expect(requireWorkspaceCapability).toHaveBeenCalledWith(
      authCtxMock,
      'content.view',
      expect.any(String)
    );
  });

  it('throws 404 when the page does not exist', async () => {
    const db = makeDb({
      project: { getAnyContentNodeById: vi.fn(async () => null) }
    });

    await expect(listWikiComments(db, 'ws-1', 'missing', event)).rejects.toMatchObject({
      status: 404
    });
  });

  it('falls back to a placeholder name when the author was deleted', async () => {
    const db = makeDb({
      wikiComment: {
        listByNode: vi.fn(async () => [makeComment({ author_id: null })])
      }
    });

    const result = await listWikiComments(db, 'ws-1', 'node-1', event);
    expect(result[0]!.authorId).toBeNull();
    expect(result[0]!.authorName).toBe('Unknown user');
  });
});

describe('createWikiComment', () => {
  it('creates a root comment with an anchor and requires the comments capability', async () => {
    const db = makeDb();
    const anchor = { quote: 'quoted', prefix: 'pre', suffix: 'suf', start: 1, end: 7 };
    const result = await createWikiComment(
      db,
      'ws-1',
      'node-1',
      { nodeId: 'node-1', body: 'New comment', anchor },
      event
    );

    expect(requireWorkspaceCapability).toHaveBeenCalledWith(
      authCtxMock,
      'comments',
      expect.any(String)
    );
    expect(db.wikiComment.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-comment-id',
        node_id: 'node-1',
        author_id: 'user-1',
        parent_post_id: null,
        quote: 'quoted',
        anchor_start: 1,
        anchor_end: 7
      })
    );
    expect(result.id).toBe('comment-1');
  });

  it('rejects a root comment with no anchor', async () => {
    const db = makeDb();

    await expect(
      createWikiComment(db, 'ws-1', 'node-1', { nodeId: 'node-1', body: 'New comment' }, event)
    ).rejects.toMatchObject({ status: 400 });
    expect(db.wikiComment.createPost).not.toHaveBeenCalled();
  });

  it('inherits the anchor from the root post when replying', async () => {
    const db = makeDb();
    const result = await createWikiComment(
      db,
      'ws-1',
      'node-1',
      { nodeId: 'node-1', parentPostId: 'comment-1', body: 'Reply' },
      event
    );

    expect(db.wikiComment.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_post_id: 'comment-1',
        quote: 'the quoted text',
        anchor_start: 10,
        anchor_end: 26
      })
    );
    expect(result.id).toBe('comment-1');
  });

  it('rejects a reply whose parent belongs to a different page', async () => {
    const db = makeDb({
      wikiComment: {
        getPost: vi.fn(async () => makeComment({ node_id: 'other-node' }))
      }
    });

    await expect(
      createWikiComment(
        db,
        'ws-1',
        'node-1',
        { nodeId: 'node-1', parentPostId: 'comment-1', body: 'Reply' },
        event
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a reply whose parent is itself a reply', async () => {
    const db = makeDb({
      wikiComment: {
        getPost: vi.fn(async () => makeComment({ id: 'reply-1', parent_post_id: 'root-1' })),
        createPost: vi.fn()
      }
    });

    await expect(
      createWikiComment(
        db,
        'ws-1',
        'node-1',
        { nodeId: 'node-1', parentPostId: 'reply-1', body: 'Reply' },
        event
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(db.wikiComment.createPost).not.toHaveBeenCalled();
  });

  it('404s when replying to a comment that does not exist', async () => {
    const db = makeDb({
      wikiComment: { getPost: vi.fn(async () => null) }
    });

    await expect(
      createWikiComment(
        db,
        'ws-1',
        'node-1',
        { nodeId: 'node-1', parentPostId: 'missing', body: 'Reply' },
        event
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateWikiComment', () => {
  it('allows the author to edit their own comment', async () => {
    const db = makeDb();
    const result = await updateWikiComment(db, 'ws-1', 'comment-1', { body: 'Updated' }, event);

    expect(result.body).toBe('Updated');
    expect(result.editedAt).not.toBeNull();
  });

  it('rejects edits from a different user', async () => {
    const db = makeDb();

    await expect(
      updateWikiComment(db, 'ws-1', 'comment-1', { body: 'Hacked' }, otherUserEvent)
    ).rejects.toMatchObject({ status: 403 });
    expect(db.wikiComment.updatePost).not.toHaveBeenCalled();
  });

  it('404s when the comment does not exist', async () => {
    const db = makeDb({ wikiComment: { getPost: vi.fn(async () => null) } });

    await expect(
      updateWikiComment(db, 'ws-1', 'missing', { body: 'x' }, event)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('resolveWikiComment', () => {
  it('marks a root thread resolved', async () => {
    const db = makeDb();
    const result = await resolveWikiComment(db, 'ws-1', 'comment-1', true, event);

    expect(db.wikiComment.setResolved).toHaveBeenCalledWith(
      'ws-1',
      'comment-1',
      expect.any(Date),
      'user-1',
      expect.any(Date)
    );
    expect(result.resolvedAt).not.toBeNull();
  });

  it('rejects resolving a reply', async () => {
    const db = makeDb({
      wikiComment: {
        getPost: vi.fn(async () => makeComment({ id: 'reply-1', parent_post_id: 'root-1' }))
      }
    });

    await expect(resolveWikiComment(db, 'ws-1', 'reply-1', true, event)).rejects.toMatchObject({
      status: 400
    });
  });
});

describe('deleteWikiComment', () => {
  it('allows the author to delete their own comment', async () => {
    const db = makeDb();
    const result = await deleteWikiComment(db, 'ws-1', 'comment-1', event);

    expect(result.success).toBe(true);
    expect(db.wikiComment.deletePost).toHaveBeenCalledWith('ws-1', 'comment-1');
  });

  it('rejects deletes from a different user', async () => {
    const db = makeDb();

    await expect(deleteWikiComment(db, 'ws-1', 'comment-1', otherUserEvent)).rejects.toMatchObject({
      status: 403
    });
    expect(db.wikiComment.deletePost).not.toHaveBeenCalled();
  });
});
