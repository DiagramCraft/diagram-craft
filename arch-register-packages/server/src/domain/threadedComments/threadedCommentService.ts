import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';

const UNKNOWN_AUTHOR_NAME = 'Unknown user';

export type ThreadedCommentRow = {
  id: string;
  workspace: string;
  parent_post_id: string | null;
  author_id: string | null;
  body: string;
  created_at: Date;
  updated_at: Date;
  edited_at: Date | null;
};

export type ThreadedCommentCreateRequest = {
  parentPostId?: string;
  body: string;
};

export type ThreadedCommentApiBase = {
  id: string;
  workspace: string;
  parentPostId: string | null;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
};

type CreateThreadedCommentParams<TTarget, TRequest, TRow extends ThreadedCommentRow> = {
  workspace: string;
  id: string;
  target: TTarget;
  request: TRequest;
  body: string;
  parentPostId: string | null;
  parent: TRow | null;
  authorId: string;
  timestamp: Date;
};

type NotifyThreadedCommentParams<TTarget, TRequest, TRow extends ThreadedCommentRow> = {
  workspace: string;
  target: TTarget;
  request: TRequest;
  row: TRow;
  parentPostId: string | null;
  parentAuthorId: string | null;
  actorUserId: string;
  occurredAt: Date;
};

export type ThreadedCommentAdapter<
  TAuthContext extends WorkspaceAuthorizationContext,
  TTarget,
  TRequest extends ThreadedCommentCreateRequest,
  TRow extends ThreadedCommentRow,
  TResult,
  TCreateInput
> = {
  buildTargetAuthContext: (
    db: DatabaseAdapter,
    workspace: string,
    event: AuthenticatedEvent
  ) => Promise<TAuthContext>;
  resolveTarget: (
    db: DatabaseAdapter,
    workspace: string,
    authCtx: TAuthContext,
    target: TTarget
  ) => Promise<void>;
  listPosts: (db: DatabaseAdapter, workspace: string, target: TTarget) => Promise<TRow[]>;
  getPost: (db: DatabaseAdapter, workspace: string, postId: string) => Promise<TRow | null>;
  validateParentTarget: (parent: TRow, target: TTarget) => void;
  createInput: (params: CreateThreadedCommentParams<TTarget, TRequest, TRow>) => TCreateInput;
  createPost: (db: DatabaseAdapter, input: TCreateInput) => Promise<TRow>;
  updatePost: (
    db: DatabaseAdapter,
    workspace: string,
    postId: string,
    body: string,
    updatedAt: Date,
    editedAt: Date
  ) => Promise<TRow | null>;
  deletePost: (db: DatabaseAdapter, workspace: string, postId: string) => Promise<TRow | null>;
  toApiPost: (row: TRow, authorNames: Map<string, string>) => TResult;
  createPermissionMessage?: string;
  createNotifications?: (
    db: DatabaseAdapter,
    params: NotifyThreadedCommentParams<TTarget, TRequest, TRow>
  ) => Promise<void>;
  resolvePost?: (
    db: DatabaseAdapter,
    workspace: string,
    postId: string,
    resolvedAt: Date | null,
    resolvedBy: string | null,
    updatedAt: Date
  ) => Promise<TRow | null>;
};

export const buildAuthorNameMap = async (db: DatabaseAdapter) => {
  const users = await db.auth.listUsers();
  return new Map(users.map(user => [user.id, user.display_name]));
};

export const mapThreadedCommentBase = (
  row: ThreadedCommentRow,
  authorNames: Map<string, string>
): ThreadedCommentApiBase => ({
  id: row.id,
  workspace: row.workspace,
  parentPostId: row.parent_post_id,
  authorId: row.author_id,
  authorName: (row.author_id && authorNames.get(row.author_id)) ?? UNKNOWN_AUTHOR_NAME,
  body: row.body,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  editedAt: row.edited_at ? row.edited_at.toISOString() : null
});

export const listThreadedComments = async <
  TAuthContext extends WorkspaceAuthorizationContext,
  TTarget,
  TRequest extends ThreadedCommentCreateRequest,
  TRow extends ThreadedCommentRow,
  TResult,
  TCreateInput
>(
  db: DatabaseAdapter,
  workspace: string,
  target: TTarget,
  event: AuthenticatedEvent,
  adapter: ThreadedCommentAdapter<TAuthContext, TTarget, TRequest, TRow, TResult, TCreateInput>
): Promise<TResult[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await adapter.buildTargetAuthContext(db, ws, event);
  await adapter.resolveTarget(db, ws, authCtx, target);

  const [rows, authorNames] = await Promise.all([
    adapter.listPosts(db, ws, target),
    buildAuthorNameMap(db)
  ]);
  return rows.map(row => adapter.toApiPost(row, authorNames));
};

export const createThreadedComment = async <
  TAuthContext extends WorkspaceAuthorizationContext,
  TTarget,
  TRequest extends ThreadedCommentCreateRequest,
  TRow extends ThreadedCommentRow,
  TResult,
  TCreateInput
>(
  db: DatabaseAdapter,
  workspace: string,
  target: TTarget,
  request: TRequest,
  event: AuthenticatedEvent,
  adapter: ThreadedCommentAdapter<TAuthContext, TTarget, TRequest, TRow, TResult, TCreateInput>
): Promise<TResult> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await adapter.buildTargetAuthContext(db, ws, event);
  await adapter.resolveTarget(db, ws, authCtx, target);
  requireWorkspaceCapability(authCtx, 'comments', adapter.createPermissionMessage);

  const parentPostId = request.parentPostId ?? null;
  let parent: TRow | null = null;
  if (parentPostId) {
    parent = await adapter.getPost(db, ws, parentPostId);
    httpAssert.present(parent, { status: 404, message: `Post '${parentPostId}' not found` });
    adapter.validateParentTarget(parent, target);
    httpAssert.true(parent.parent_post_id === null, {
      status: 400,
      message: 'Reply must target a root post, not another reply'
    });
  }

  const timestamp = new Date();
  const createInput = adapter.createInput({
    workspace: ws,
    id: randomUUID(),
    target,
    request,
    body: request.body,
    parentPostId,
    parent,
    authorId: event.context.user.id,
    timestamp
  });
  const write = async (tx: DatabaseAdapter) => {
    const row = await adapter.createPost(tx, createInput);

    if (adapter.createNotifications) {
      await adapter.createNotifications(tx, {
        workspace: ws,
        target,
        request,
        row,
        parentPostId,
        parentAuthorId: parent?.author_id ?? null,
        actorUserId: event.context.user.id,
        occurredAt: timestamp
      });
    }
    return row;
  };
  const row =
    db.core && !db.core.isTransaction ? await db.core.transaction(write) : await write(db);

  const authorNames = await buildAuthorNameMap(db);
  return adapter.toApiPost(row, authorNames);
};

export const updateThreadedComment = async <
  TAuthContext extends WorkspaceAuthorizationContext,
  TTarget,
  TRequest extends ThreadedCommentCreateRequest,
  TRow extends ThreadedCommentRow,
  TResult,
  TCreateInput
>(
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  body: string,
  event: AuthenticatedEvent,
  adapter: ThreadedCommentAdapter<TAuthContext, TTarget, TRequest, TRow, TResult, TCreateInput>
): Promise<TResult> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await adapter.getPost(db, ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.author_id === event.context.user.id, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You can only edit your own posts'
  });

  const timestamp = new Date();
  const row = await adapter.updatePost(db, ws, postId, body, timestamp, timestamp);
  httpAssert.present(row, { status: 404, message: `Post '${postId}' not found` });

  const authorNames = await buildAuthorNameMap(db);
  return adapter.toApiPost(row, authorNames);
};

export const deleteThreadedComment = async <
  TAuthContext extends WorkspaceAuthorizationContext,
  TTarget,
  TRequest extends ThreadedCommentCreateRequest,
  TRow extends ThreadedCommentRow,
  TResult,
  TCreateInput
>(
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  event: AuthenticatedEvent,
  adapter: ThreadedCommentAdapter<TAuthContext, TTarget, TRequest, TRow, TResult, TCreateInput>
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await adapter.getPost(db, ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.author_id === event.context.user.id, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You can only delete your own posts'
  });

  await adapter.deletePost(db, ws, postId);
  return { success: true, message: 'Post deleted' };
};

export const resolveThreadedComment = async <
  TAuthContext extends WorkspaceAuthorizationContext,
  TTarget,
  TRequest extends ThreadedCommentCreateRequest,
  TRow extends ThreadedCommentRow,
  TResult,
  TCreateInput
>(
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  resolved: boolean,
  event: AuthenticatedEvent,
  adapter: ThreadedCommentAdapter<TAuthContext, TTarget, TRequest, TRow, TResult, TCreateInput>
): Promise<TResult> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await adapter.getPost(db, ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.parent_post_id === null, {
    status: 400,
    message: 'Only a root post can be resolved'
  });
  httpAssert.present(adapter.resolvePost, {
    status: 500,
    message: 'Comment resolution is not supported for this surface'
  });

  const timestamp = new Date();
  const row = await adapter.resolvePost(
    db,
    ws,
    postId,
    resolved ? timestamp : null,
    resolved ? event.context.user.id : null,
    timestamp
  );
  httpAssert.present(row, { status: 404, message: `Post '${postId}' not found` });

  const authorNames = await buildAuthorNameMap(db);
  return adapter.toApiPost(row, authorNames);
};
