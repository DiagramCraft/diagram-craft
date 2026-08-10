import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireProjectAccess, requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { WikiCommentDbCreate, WikiCommentDbResult } from './db/wikiCommentDatabase';
import type {
  CreateWikiCommentRequest,
  UpdateWikiCommentRequest,
  WikiComment
} from '@arch-register/api-types/wikiCommentContract';
import { createCommentNotifications } from '../notification/commentNotifications';
import {
  createThreadedComment,
  deleteThreadedComment,
  listThreadedComments,
  mapThreadedCommentBase,
  resolveThreadedComment,
  updateThreadedComment,
  type ThreadedCommentAdapter
} from '../threadedComments/threadedCommentService';

const resolveNodeContext = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: WorkspaceAuthorizationContext,
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

const wikiCommentAdapter: ThreadedCommentAdapter<
  WorkspaceAuthorizationContext,
  string,
  CreateWikiCommentRequest,
  WikiCommentDbResult,
  WikiComment,
  WikiCommentDbCreate
> = {
  targetScope: 'workspace',
  resolveTarget: async (db, ws, authCtx, nodeId) => {
    await resolveNodeContext(db, ws, authCtx, nodeId);
  },
  listPosts: (db, ws, nodeId) => db.wikiComment.listByNode(ws, nodeId),
  getPost: (db, ws, postId) => db.wikiComment.getPost(ws, postId),
  validateParentTarget: (parent, nodeId) => {
    httpAssert.true(parent.node_id === nodeId, {
      status: 400,
      message: 'Reply must target a post on the same page'
    });
  },
  createInput: ({
    workspace,
    id,
    target,
    request,
    parentPostId,
    authorId,
    body,
    timestamp,
    parent
  }) => {
    const anchor = parent
      ? {
          quote: parent.quote,
          prefix: parent.prefix,
          suffix: parent.suffix,
          start: parent.anchor_start,
          end: parent.anchor_end
        }
      : request.anchor;
    httpAssert.present(anchor, { status: 400, message: 'A root comment requires an anchor' });

    return {
      id,
      workspace,
      node_id: target,
      parent_post_id: parentPostId,
      author_id: authorId,
      body,
      quote: anchor.quote,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      anchor_start: anchor.start,
      anchor_end: anchor.end,
      created_at: timestamp,
      updated_at: timestamp
    };
  },
  createPost: (db, input) => db.wikiComment.createPost(input),
  updatePost: (db, ws, postId, body, updatedAt, editedAt) =>
    db.wikiComment.updatePost(ws, postId, body, updatedAt, editedAt),
  deletePost: (db, ws, postId) => db.wikiComment.deletePost(ws, postId),
  toApiPost: (row, authorNames) => ({
    ...mapThreadedCommentBase(row, authorNames),
    nodeId: row.node_id,
    anchor: {
      quote: row.quote,
      prefix: row.prefix,
      suffix: row.suffix,
      start: row.anchor_start,
      end: row.anchor_end
    },
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    resolvedBy: row.resolved_by
  }),
  createPermissionMessage: 'You do not have permission to comment on this page',
  createNotifications: async (
    tx,
    { workspace, target, row, parentPostId, parentAuthorId, actorUserId, occurredAt }
  ) => {
    await createCommentNotifications(tx, {
      workspace,
      commentId: row.id,
      objectType: 'content_node',
      objectId: target,
      commentSurface: 'inline',
      parentPostId,
      parentAuthorId,
      actorUserId,
      occurredAt
    });
  },
  resolvePost: (db, ws, postId, resolvedAt, resolvedBy, updatedAt) =>
    db.wikiComment.setResolved(ws, postId, resolvedAt, resolvedBy, updatedAt)
};

export const listWikiComments = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
): Promise<WikiComment[]> => {
  return listThreadedComments(db, workspace, nodeId, event, wikiCommentAdapter);
};

export const createWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  body: CreateWikiCommentRequest,
  event: AuthenticatedEvent
): Promise<WikiComment> => {
  return createThreadedComment(db, workspace, nodeId, body, event, wikiCommentAdapter);
};

export const updateWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  body: UpdateWikiCommentRequest,
  event: AuthenticatedEvent
): Promise<WikiComment> => {
  return updateThreadedComment(db, workspace, postId, body.body, event, wikiCommentAdapter);
};

export const resolveWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  resolved: boolean,
  event: AuthenticatedEvent
): Promise<WikiComment> => {
  return resolveThreadedComment(db, workspace, postId, resolved, event, wikiCommentAdapter);
};

export const deleteWikiComment = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return deleteThreadedComment(db, workspace, postId, event, wikiCommentAdapter);
};
