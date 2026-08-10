import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  createThreadedComment,
  deleteThreadedComment,
  listThreadedComments,
  mapThreadedCommentBase,
  resolveThreadedComment,
  updateThreadedComment,
  type ThreadedCommentAdapter,
  type ThreadedCommentApiBase,
  type ThreadedCommentRow
} from './threadedCommentService';

const authCtxMock = {
  userId: 'user-1',
  globalPermissions: new Set(['admin_platform']),
  globalRoles: new Set(),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamIds: new Set(),
  teamAssignments: [],
  teamRolesByTeam: new Map(),
  teams: []
} as unknown as WorkspaceAuthorizationContext;

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => authCtxMock),
  buildApiEntityAuthCtx: vi.fn(async () => authCtxMock),
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'new-post-id'
}));

import { requireWorkspaceCapability } from '../auth/authorization';

type TestRequest = {
  parentPostId?: string;
  body: string;
};

type TestCreateInput = {
  id: string;
  workspace: string;
  target: string;
  parentPostId: string | null;
  authorId: string;
  body: string;
  timestamp: Date;
};

const now = new Date('2026-06-01T12:00:00.000Z');
const later = new Date('2026-06-02T12:00:00.000Z');

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;
const otherUserEvent = { context: { user: { id: 'user-2' } } } as unknown as AuthenticatedEvent;

const makeRow = (overrides: Partial<ThreadedCommentRow> = {}): ThreadedCommentRow => ({
  id: 'post-1',
  workspace: 'ws-1',
  parent_post_id: null,
  author_id: 'user-1',
  body: 'Hello',
  created_at: now,
  updated_at: now,
  edited_at: null,
  ...overrides
});

const makeDb = () => {
  let db!: DatabaseAdapter;
  db = {
    core: {
      driver: 'sqlite',
      isTransaction: false,
      close: vi.fn(async () => {}),
      transaction: vi.fn(async callback => callback(db))
    },
    catalog: {},
    auth: {
      listUsers: vi.fn(async () => [{ id: 'user-1', display_name: 'User One' }])
    }
  } as unknown as DatabaseAdapter;
  return db;
};

const makeAdapter = () => {
  const getPost = vi.fn(async () => makeRow());
  const createPost = vi.fn(async (_db: DatabaseAdapter, input: TestCreateInput) =>
    makeRow({
      id: input.id,
      workspace: input.workspace,
      parent_post_id: input.parentPostId,
      author_id: input.authorId,
      body: input.body,
      created_at: input.timestamp,
      updated_at: input.timestamp
    })
  );
  const updatePost = vi.fn(async () =>
    makeRow({ body: 'Updated', updated_at: later, edited_at: later })
  );
  const deletePost = vi.fn(async () => makeRow());
  const resolvePost = vi.fn(async () => makeRow({ updated_at: later }));
  const validateParentTarget = vi.fn();
  const createNotifications = vi.fn(async () => {});
  const toApiPost = vi.fn((row: ThreadedCommentRow, authorNames: Map<string, string>) =>
    mapThreadedCommentBase(row, authorNames)
  );

  const adapter: ThreadedCommentAdapter<
    WorkspaceAuthorizationContext,
    string,
    TestRequest,
    ThreadedCommentRow,
    ThreadedCommentApiBase,
    TestCreateInput
  > = {
    targetScope: 'workspace',
    resolveTarget: vi.fn(async () => {}),
    listPosts: vi.fn(async () => [makeRow()]),
    getPost,
    validateParentTarget,
    createInput: vi.fn(({ workspace, id, target, parentPostId, authorId, body, timestamp }) => ({
      id,
      workspace,
      target,
      parentPostId,
      authorId,
      body,
      timestamp
    })),
    createPost,
    updatePost,
    deletePost,
    toApiPost,
    createNotifications,
    resolvePost
  };

  return {
    adapter,
    resolveTarget: adapter.resolveTarget,
    createInput: adapter.createInput,
    getPost,
    createPost,
    updatePost,
    deletePost,
    resolvePost,
    validateParentTarget,
    createNotifications,
    toApiPost
  };
};

describe('threaded comment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists target posts with shared author mapping', async () => {
    const db = makeDb();
    const { adapter, resolveTarget, toApiPost } = makeAdapter();

    const result = await listThreadedComments(db, 'workspace-slug', 'target-1', event, adapter);

    expect(resolveTarget).toHaveBeenCalledWith(db, 'ws-1', authCtxMock, 'target-1');
    expect(toApiPost).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post-1' }),
      expect.any(Map)
    );
    expect(result[0]!.authorName).toBe('User One');
  });

  it('creates a root post inside a transaction and sends notifications', async () => {
    const db = makeDb();
    const { adapter, createInput, createPost, createNotifications } = makeAdapter();

    const result = await createThreadedComment(
      db,
      'workspace-slug',
      'target-1',
      { body: 'New post' },
      event,
      adapter
    );

    expect(db.core.transaction).toHaveBeenCalledOnce();
    expect(createInput).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: 'ws-1',
        id: 'new-post-id',
        target: 'target-1',
        parentPostId: null,
        authorId: 'user-1',
        body: 'New post'
      })
    );
    expect(createPost).toHaveBeenCalledOnce();
    expect(createNotifications).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        workspace: 'ws-1',
        target: 'target-1',
        parentPostId: null,
        parentAuthorId: null,
        actorUserId: 'user-1'
      })
    );
    expect(result.id).toBe('new-post-id');
  });

  it('validates a reply parent before creating the post', async () => {
    const db = makeDb();
    const { adapter, getPost, validateParentTarget, createPost } = makeAdapter();
    getPost.mockResolvedValue(makeRow({ parent_post_id: 'root-1' }));

    await expect(
      createThreadedComment(
        db,
        'workspace-slug',
        'target-1',
        { parentPostId: 'reply-1', body: 'Nested reply' },
        event,
        adapter
      )
    ).rejects.toMatchObject({ status: 400 });

    expect(validateParentTarget).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post-1' }),
      'target-1'
    );
    expect(createPost).not.toHaveBeenCalled();
  });

  it('rejects edits and deletes from users other than the author', async () => {
    const db = makeDb();
    const { adapter, updatePost, deletePost } = makeAdapter();

    await expect(
      updateThreadedComment(db, 'workspace-slug', 'post-1', 'Hacked', otherUserEvent, adapter)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteThreadedComment(db, 'workspace-slug', 'post-1', otherUserEvent, adapter)
    ).rejects.toMatchObject({ status: 403 });

    expect(updatePost).not.toHaveBeenCalled();
    expect(deletePost).not.toHaveBeenCalled();
  });

  it('updates an authored post and maps the returned row', async () => {
    const db = makeDb();
    const { adapter, updatePost, toApiPost } = makeAdapter();

    const result = await updateThreadedComment(
      db,
      'workspace-slug',
      'post-1',
      'Updated',
      event,
      adapter
    );

    expect(updatePost).toHaveBeenCalledWith(
      db,
      'ws-1',
      'post-1',
      'Updated',
      expect.any(Date),
      expect.any(Date)
    );
    expect(toApiPost).toHaveBeenCalledOnce();
    expect(result.body).toBe('Updated');
  });

  it('resolves only root posts through the optional adapter operation', async () => {
    const db = makeDb();
    const { adapter, getPost, resolvePost } = makeAdapter();

    const result = await resolveThreadedComment(
      db,
      'workspace-slug',
      'post-1',
      true,
      event,
      adapter
    );

    expect(resolvePost).toHaveBeenCalledWith(
      db,
      'ws-1',
      'post-1',
      expect.any(Date),
      'user-1',
      expect.any(Date)
    );
    expect(result.authorName).toBe('User One');

    getPost.mockResolvedValue(makeRow({ parent_post_id: 'root-1' }));
    await expect(
      resolveThreadedComment(db, 'workspace-slug', 'reply-1', true, event, adapter)
    ).rejects.toMatchObject({ status: 400 });
    expect(resolvePost).toHaveBeenCalledOnce();
  });

  it('requires the comments capability for every mutating operation', async () => {
    const db = makeDb();
    const { adapter } = makeAdapter();

    await createThreadedComment(
      db,
      'workspace-slug',
      'target-1',
      { body: 'New post' },
      event,
      adapter
    );
    await updateThreadedComment(db, 'workspace-slug', 'post-1', 'Updated', event, adapter);
    await deleteThreadedComment(db, 'workspace-slug', 'post-1', event, adapter);
    await resolveThreadedComment(db, 'workspace-slug', 'post-1', false, event, adapter);

    expect(requireWorkspaceCapability).toHaveBeenCalledWith(authCtxMock, 'comments');
  });
});
