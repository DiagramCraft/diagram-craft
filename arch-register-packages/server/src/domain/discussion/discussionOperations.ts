import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireProjectAccess,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { AuthorizationContext } from '@arch-register/permissions';
import { randomUUID } from 'node:crypto';
import type { DiscussionPostDbResult } from './db/discussionDatabase';
import type {
  CreateDiscussionPostRequest,
  DiscussionObjectType,
  DiscussionPost,
  DiscussionSummaryEntry,
  UpdateDiscussionPostRequest
} from '@arch-register/api-types/discussionContract';

const UNKNOWN_AUTHOR_NAME = 'Unknown user';

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
      httpAssert.present(project, { status: 404, message: `Project '${node.project_id}' not found` });
      requireProjectAccess(authCtx, project.owner, 'You do not have permission to view this page');
    } else {
      requireWorkspaceCapability(authCtx, 'content.view', 'You do not have permission to view this page');
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
    httpAssert.present(project, { status: 404, message: `Project '${assessment.project_id}' not found` });
    requireProjectAccess(authCtx, project.owner, 'You do not have permission to view this assessment');
    return {
      title: assessment.name,
      nav: { type: 'assessment', projectPublicId: project.public_id ?? project.id }
    };
  }

  const entity = await db.catalog.getEntity(ws, objectId);
  httpAssert.present(entity, { status: 404, message: `Entity '${objectId}' not found` });
  requireEntityAction(authCtx, entity, 'view_entity', 'You do not have permission to view this entity');
  return {
    title: entity.name,
    nav: { type: 'entity', entityPublicId: entity.public_id ?? entity.id }
  };
};

const toApiPost = (row: DiscussionPostDbResult, authorNames: Map<string, string>): DiscussionPost => ({
  id: row.id,
  workspace: row.workspace,
  objectType: row.object_type,
  objectId: row.object_id,
  parentPostId: row.parent_post_id,
  authorId: row.author_id,
  authorName: (row.author_id && authorNames.get(row.author_id)) || UNKNOWN_AUTHOR_NAME,
  body: row.body,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  editedAt: row.edited_at ? row.edited_at.toISOString() : null
});

const buildAuthorNameMap = async (db: DatabaseAdapter) => {
  const users = await db.auth.listUsers();
  return new Map(users.map(user => [user.id, user.display_name]));
};

export const listDiscussionPosts = async (
  db: DatabaseAdapter,
  workspace: string,
  objectType: DiscussionObjectType,
  objectId: string,
  event: AuthenticatedEvent
): Promise<DiscussionPost[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  await resolveObjectContext(db, ws, authCtx, objectType, objectId);

  const [rows, authorNames] = await Promise.all([
    db.discussion.listByObject(ws, objectType, objectId),
    buildAuthorNameMap(db)
  ]);
  return rows.map(row => toApiPost(row, authorNames));
};

export const summarizeDiscussions = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<DiscussionSummaryEntry[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const [rows, authorNames] = await Promise.all([db.discussion.listAll(ws), buildAuthorNameMap(db)]);

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
    const lastPost = posts.reduce((latest, post) => (post.created_at > latest.created_at ? post : latest));
    entries.push({
      objectType: first.object_type,
      objectId: first.object_id,
      objectTitle: context.title,
      nav: context.nav,
      postCount: posts.length,
      lastPost: toApiPost(lastPost, authorNames)
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  await resolveObjectContext(db, ws, authCtx, body.objectType, body.objectId);
  requireWorkspaceCapability(authCtx, 'comments', 'You do not have permission to post discussions');

  if (body.parentPostId) {
    const parent = await db.discussion.getPost(ws, body.parentPostId);
    httpAssert.present(parent, { status: 404, message: `Post '${body.parentPostId}' not found` });
    httpAssert.true(parent.object_type === body.objectType && parent.object_id === body.objectId, {
      status: 400,
      message: 'Reply must target a post on the same object'
    });
    httpAssert.true(parent.parent_post_id === null, {
      status: 400,
      message: 'Reply must target a root post, not another reply'
    });
  }

  const timestamp = new Date();
  const row = await db.discussion.createPost({
    id: randomUUID(),
    workspace: ws,
    object_type: body.objectType,
    object_id: body.objectId,
    parent_post_id: body.parentPostId ?? null,
    author_id: event.context.user.id,
    body: body.body,
    created_at: timestamp,
    updated_at: timestamp
  });

  const authorNames = await buildAuthorNameMap(db);
  return toApiPost(row, authorNames);
};

export const updateDiscussionPost = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  body: UpdateDiscussionPostRequest,
  event: AuthenticatedEvent
): Promise<DiscussionPost> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await db.discussion.getPost(ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.author_id === event.context.user.id, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You can only edit your own posts'
  });

  const timestamp = new Date();
  const row = await db.discussion.updatePost(ws, postId, body.body, timestamp, timestamp);
  httpAssert.present(row, { status: 404, message: `Post '${postId}' not found` });

  const authorNames = await buildAuthorNameMap(db);
  return toApiPost(row, authorNames);
};

export const deleteDiscussionPost = async (
  db: DatabaseAdapter,
  workspace: string,
  postId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'comments');

  const existing = await db.discussion.getPost(ws, postId);
  httpAssert.present(existing, { status: 404, message: `Post '${postId}' not found` });
  httpAssert.true(existing.author_id === event.context.user.id, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You can only delete your own posts'
  });

  await db.discussion.deletePost(ws, postId);
  return { success: true, message: 'Post deleted' };
};
