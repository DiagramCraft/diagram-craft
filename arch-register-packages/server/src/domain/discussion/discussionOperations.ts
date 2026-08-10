import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiEntityAuthCtx,
  requireEntityAction,
  requireProjectAccess,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DiscussionPostDbCreate, DiscussionPostDbResult } from './db/discussionDatabase';
import type {
  CreateDiscussionPostRequest,
  DiscussionObjectType,
  DiscussionPost,
  DiscussionSummaryEntry,
  UpdateDiscussionPostRequest
} from '@arch-register/api-types/discussionContract';
import { createCommentNotifications } from '../notification/commentNotifications';
import {
  buildAuthorNameMap,
  createThreadedComment,
  deleteThreadedComment,
  listThreadedComments,
  mapThreadedCommentBase,
  updateThreadedComment,
  type ThreadedCommentAdapter
} from '../threadedComments/threadedCommentService';

type DiscussionObjectContext = {
  title: string;
  nav: DiscussionSummaryEntry['nav'];
};

const resolveObjectContext = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: AuthorizationContext,
  objectType: DiscussionObjectType,
  objectId: string
): Promise<DiscussionObjectContext> => {
  if (objectType === 'content_node') {
    const node = await db.project.getAnyContentNodeById(ws, objectId);
    httpAssert.present(node, { status: 404, message: `Content node '${objectId}' not found` });

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

    const entity = node.entity_id ? await db.catalog.getEntity(ws, node.entity_id) : null;
    return {
      title: node.name,
      nav: {
        type: 'content_node',
        projectPublicId: node.project_public_id ?? undefined,
        entityPublicId: entity ? (entity.public_id ?? entity.id) : undefined
      }
    };
  }

  if (objectType === 'assessment') {
    const assessment = await db.project.getAssessmentById(ws, objectId);
    httpAssert.present(assessment, { status: 404, message: `Assessment '${objectId}' not found` });
    const project = await db.project.getProject(ws, assessment.project_id);
    httpAssert.present(project, {
      status: 404,
      message: `Project '${assessment.project_id}' not found`
    });
    requireProjectAccess(
      authCtx,
      project.owner,
      'You do not have permission to view this assessment'
    );
    return {
      title: assessment.name,
      nav: { type: 'assessment', projectPublicId: project.public_id ?? project.id }
    };
  }

  const entity = await db.catalog.getEntity(ws, objectId);
  httpAssert.present(entity, { status: 404, message: `Entity '${objectId}' not found` });
  requireEntityAction(
    authCtx,
    entity,
    'view_entity',
    'You do not have permission to view this entity'
  );
  return {
    title: entity.name,
    nav: { type: 'entity', entityPublicId: entity.public_id ?? entity.id }
  };
};

type DiscussionTarget = {
  objectType: DiscussionObjectType;
  objectId: string;
};

const discussionCommentAdapter: ThreadedCommentAdapter<
  AuthorizationContext,
  DiscussionTarget,
  CreateDiscussionPostRequest,
  DiscussionPostDbResult,
  DiscussionPost,
  DiscussionPostDbCreate
> = {
  buildTargetAuthContext: buildApiEntityAuthCtx,
  resolveTarget: async (db, ws, authCtx, target) => {
    await resolveObjectContext(db, ws, authCtx, target.objectType, target.objectId);
  },
  listPosts: (db, ws, target) => db.discussion.listByObject(ws, target.objectType, target.objectId),
  getPost: (db, ws, postId) => db.discussion.getPost(ws, postId),
  validateParentTarget: (parent, target) => {
    httpAssert.true(
      parent.object_type === target.objectType && parent.object_id === target.objectId,
      {
        status: 400,
        message: 'Reply must target a post on the same object'
      }
    );
  },
  createInput: ({ workspace, id, target, parentPostId, authorId, body, timestamp }) => ({
    id,
    workspace,
    object_type: target.objectType,
    object_id: target.objectId,
    parent_post_id: parentPostId,
    author_id: authorId,
    body,
    created_at: timestamp,
    updated_at: timestamp
  }),
  createPost: (db, input) => db.discussion.createPost(input),
  updatePost: (db, ws, postId, body, updatedAt, editedAt) =>
    db.discussion.updatePost(ws, postId, body, updatedAt, editedAt),
  deletePost: (db, ws, postId) => db.discussion.deletePost(ws, postId),
  toApiPost: (row, authorNames) => ({
    ...mapThreadedCommentBase(row, authorNames),
    objectType: row.object_type,
    objectId: row.object_id
  }),
  createPermissionMessage: 'You do not have permission to post discussions',
  createNotifications: async (
    tx,
    { workspace, target, row, parentPostId, parentAuthorId, actorUserId, occurredAt }
  ) => {
    if (target.objectType === 'assessment') return;

    await createCommentNotifications(tx, {
      workspace,
      commentId: row.id,
      objectType: target.objectType,
      objectId: target.objectId,
      commentSurface: 'discussion',
      parentPostId,
      parentAuthorId,
      actorUserId,
      occurredAt
    });
  }
};

export const listDiscussionPosts = async (
  db: DatabaseAdapter,
  workspace: string,
  objectType: DiscussionObjectType,
  objectId: string,
  event: AuthenticatedEvent
): Promise<DiscussionPost[]> => {
  return listThreadedComments(
    db,
    workspace,
    { objectType, objectId },
    event,
    discussionCommentAdapter
  );
};

export const summarizeDiscussions = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<DiscussionSummaryEntry[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiEntityAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const [rows, authorNames] = await Promise.all([
    db.discussion.listAll(ws),
    buildAuthorNameMap(db)
  ]);

  const byObject = new Map<string, DiscussionPostDbResult[]>();
  for (const row of rows) {
    const key = `${row.object_type}:${row.object_id}`;
    const existing = byObject.get(key);
    if (existing) existing.push(row);
    else byObject.set(key, [row]);
  }

  const entries: DiscussionSummaryEntry[] = [];
  for (const posts of byObject.values()) {
    const [first] = posts;
    if (!first) continue;
    let context: DiscussionObjectContext;
    try {
      context = await resolveObjectContext(db, ws, authCtx, first.object_type, first.object_id);
    } catch {
      continue;
    }
    const lastPost = posts.reduce((latest, post) =>
      post.created_at > latest.created_at ? post : latest
    );
    entries.push({
      objectType: first.object_type,
      objectId: first.object_id,
      objectTitle: context.title,
      nav: context.nav,
      postCount: posts.length,
      lastPost: discussionCommentAdapter.toApiPost(lastPost, authorNames)
    });
  }

  return entries.sort((a, b) => b.lastPost.createdAt.localeCompare(a.lastPost.createdAt));
};

export const createDiscussionPost = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateDiscussionPostRequest,
  event: AuthenticatedEvent
): Promise<DiscussionPost> => {
  return createThreadedComment(
    db,
    workspace,
    { objectType: body.objectType, objectId: body.objectId },
    body,
    event,
    discussionCommentAdapter
  );
};

export const updateDiscussionPost = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  body: UpdateDiscussionPostRequest,
  event: AuthenticatedEvent
): Promise<DiscussionPost> => {
  return updateThreadedComment(db, workspace, postId, body.body, event, discussionCommentAdapter);
};

export const deleteDiscussionPost = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return deleteThreadedComment(db, workspace, postId, event, discussionCommentAdapter);
};
