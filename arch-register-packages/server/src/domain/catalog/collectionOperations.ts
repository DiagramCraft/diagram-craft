import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { Collection } from '@arch-register/api-types/collectionContract';

const toApiCollection = (
  collection: Awaited<ReturnType<DatabaseAdapter['view']['getCollection']>>
): Collection => {
  if (!collection) throw new Error('Collection not found');
  return {
    id: collection.id,
    workspaceId: collection.workspace,
    name: collection.name,
    entityCount: collection.entity_count,
    ...(collection.is_member === undefined ? {} : { isMember: collection.is_member }),
    createdAt: collection.created_at.toISOString(),
    updatedAt: collection.updated_at.toISOString()
  };
};

export const listCollections = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  entityId?: string
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const collections = await db.view.listCollections(authCtx.userId, workspace, entityId);
  return collections.map(collection => toApiCollection(collection));
};

export const createCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  name: string
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const normalizedName = name.trim();
  httpAssert.true(normalizedName, { status: 400, message: 'Collection name is required' });
  const now = new Date();
  const collection = await db.view.createCollection({
    id: randomUUID(),
    user_id: authCtx.userId,
    workspace,
    name: normalizedName,
    created_at: now,
    updated_at: now
  });
  return toApiCollection(collection);
};

export const updateCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent,
  name: string
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const normalizedName = name.trim();
  httpAssert.true(normalizedName, { status: 400, message: 'Collection name is required' });
  const updated = await db.view.updateCollection(authCtx.userId, workspace, id, {
    name: normalizedName,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Collection not found' });
  return toApiCollection(updated);
};

export const deleteCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const deleted = await db.view.deleteCollection(authCtx.userId, workspace, id);
  httpAssert.present(deleted, { status: 404, message: 'Collection not found' });
  return { success: true, message: 'Collection deleted' };
};

export const addEntityToCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  collectionId: string,
  entityId: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const collection = await db.view.getCollection(authCtx.userId, workspace, collectionId);
  httpAssert.present(collection, { status: 404, message: 'Collection not found' });
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  requireEntityAction(authCtx, entity, 'view_entity', 'You do not have access to add this entity');
  await db.view.addCollectionEntity(authCtx.userId, workspace, collectionId, entity.id, new Date());
  return { success: true, message: 'Entity added to collection' };
};

export const removeEntityFromCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  collectionId: string,
  entityId: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const collection = await db.view.getCollection(authCtx.userId, workspace, collectionId);
  httpAssert.present(collection, { status: 404, message: 'Collection not found' });
  await db.view.removeCollectionEntity(authCtx.userId, workspace, collectionId, entityId);
  return { success: true, message: 'Entity removed from collection' };
};
