import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  requireProjectAccess,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { AuthorizationContext } from '@arch-register/permissions';
import { randomUUID } from 'node:crypto';
import type { WikiCommentDbResult } from './db/wikiCommentDatabase';
import type {
  CreateWikiCommentRequest,
  UpdateWikiCommentRequest,
  WikiComment
} from '@arch-register/api-types/wikiCommentContract';

const UNKNOWN_AUTHOR_NAME = 'Unknown user';

const resolveNodeContext = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: AuthorizationContext,
  nodeId: string
) => {
  const node = await db.project.getAnyContentNodeById(ws, nodeId);
  httpAssert.present(node, { status: 404, message: `Content node '${nodeId}' not found` });

  if (node.project_id) {
    const project = await db.project.getProject(ws, node.project_id);
    httpAssert.present(project, {
      status: 404,
      message: `Project '${node.project_id}' not found`
    });
    requireProjectAccess(authCtx, project.owner, 'You do not have permission to view this page');
  } else {
    requireWorkspaceCapability(
      authCtx,
      'content.view',
      'You do not have permission to view this page'
    );
  }

  return node;
};

const toApiPost = (row: WikiCommentDbResult, authorNames: Map<string, string>): WikiComment => ({
  id: row.id,
  workspace: row.workspace,
  nodeId: row.node_id,
  parentPostId: row.parent_post_id,
  authorId: row.author_id,
  authorName: (row.author_id && authorNames.get(row.author_id)) ?? UNKNOWN_AUTHOR_NAME,
  body: row.body,
  anchor: {
    quote: row.quote,
    prefix: row.prefix,
    suffix: row.suffix,
    start: row.anchor_start,
    end: row.anchor_end
  },
  resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  resolvedBy: row.resolved_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  editedAt: row.edited_at ? row.edited_at.toISOString() : null
});

const buildAuthorNameMap = async (db: DatabaseAdapter) => {
  const users = await db.auth.listUsers();
  return new Map(users.map(user => [user.id, user.display_name]));
};

export const listWikiComments = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
): Promise<WikiComment[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  await resolveNodeContext(db, ws, authCtx, nodeId);

  const [rows, authorNames] = await Promise.all([
    db.wikiComment.listByNode(ws, nodeId),
    buildAuthorNameMap(db)
  ]);
  return rows.map(row => toApiPost(row, authorNames));
};

export const createWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  body: CreateWikiCommentRequest,
  event: AuthenticatedEvent
): Promise<WikiComment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  await resolveNodeContext(db, ws, authCtx, nodeId);
  requireWorkspaceCapability(
    authCtx,
    'comments',
    'You do not have permission to comment on this page'
  );

  let anchor = body.anchor;

  if (body.parentPostId) {
    const parent = await db.wikiComment.getPost(ws, body.parentPostId);
    httpAssert.present(parent, { status: 404, message: `Post '${body.parentPostId}' not found` });
    httpAssert.true(parent.node_id === nodeId, {
      status: 400,
      message: 'Reply must target a post on the same page'
    });
    httpAssert.true(parent.parent_post_id === null, {
      status: 400,
      message: 'Reply must target a root post, not another reply'
    });
    anchor = {
      quote: parent.quote,
      prefix: parent.prefix,
      suffix: parent.suffix,
      start: parent.anchor_start,
      end: parent.anchor_end
    };
  }

  httpAssert.present(anchor, { status: 400, message: 'A root comment requires an anchor' });

  const timestamp = new Date();
  const row = await db.wikiComment.createPost({
    id: randomUUID(),
    workspace: ws,
    node_id: nodeId,
    parent_post_id: body.parentPostId ?? null,
    author_id: event.context.user.id,
    body: body.body,
    quote: anchor.quote,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    anchor_start: anchor.start,
    anchor_end: anchor.end,
    created_at: timestamp,
    updated_at: timestamp
  });

  const authorNames = await buildAuthorNameMap(db);
  return toApiPost(row, authorNames);
};

export const updateWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  body: UpdateWikiCommentRequest,
  event: AuthenticatedEvent
): Promise<WikiComment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await db.wikiComment.getPost(ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.author_id === event.context.user.id, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You can only edit your own posts'
  });

  const timestamp = new Date();
  const row = await db.wikiComment.updatePost(ws, postId, body.body, timestamp, timestamp);
  httpAssert.present(row, { status: 404, message: `Post '${postId}' not found` });

  const authorNames = await buildAuthorNameMap(db);
  return toApiPost(row, authorNames);
};

export const resolveWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  resolved: boolean,
  event: AuthenticatedEvent
): Promise<WikiComment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await db.wikiComment.getPost(ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.parent_post_id === null, {
    status: 400,
    message: 'Only a root post can be resolved'
  });

  const timestamp = new Date();
  const row = await db.wikiComment.setResolved(
    ws,
    postId,
    resolved ? timestamp : null,
    resolved ? event.context.user.id : null,
    timestamp
  );
  httpAssert.present(row, { status: 404, message: `Post '${postId}' not found` });

  const authorNames = await buildAuthorNameMap(db);
  return toApiPost(row, authorNames);
};

export const deleteWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await db.wikiComment.getPost(ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.author_id === event.context.user.id, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You can only delete your own posts'
  });

  await db.wikiComment.deletePost(ws, postId);
  return { success: true, message: 'Post deleted' };
};
