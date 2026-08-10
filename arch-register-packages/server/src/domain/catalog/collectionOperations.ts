import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireEntityAction, requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
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
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const collections = await db.view.listCollections(authCtx.userId, ws, entityId);
      return collections.map(collection => toApiCollection(collection));
    }
  });
};

export const createCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  name: string
) => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const normalizedName = name.trim();
      httpAssert.true(normalizedName, { status: 400, message: 'Collection name is required' });
      const now = new Date();
      const collection = await db.view.createCollection({
        id: randomUUID(),
        user_id: authCtx.userId,
        workspace: ws,
        name: normalizedName,
        created_at: now,
        updated_at: now
      });
      return toApiCollection(collection);
    }
  });
};

export const updateCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent,
  name: string
) => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const normalizedName = name.trim();
      httpAssert.true(normalizedName, { status: 400, message: 'Collection name is required' });
      const updated = await db.view.updateCollection(authCtx.userId, ws, id, {
        name: normalizedName,
        updated_at: new Date()
      });
      httpAssert.present(updated, { status: 404, message: 'Collection not found' });
      return toApiCollection(updated);
    }
  });
};

export const deleteCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const deleted = await db.view.deleteCollection(authCtx.userId, ws, id);
      httpAssert.present(deleted, { status: 404, message: 'Collection not found' });
      return { success: true, message: 'Collection deleted' };
    }
  });
};

export const addEntityToCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  collectionId: string,
  entityId: string,
  event: AuthenticatedEvent
) => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const collection = await db.view.getCollection(authCtx.userId, ws, collectionId);
      httpAssert.present(collection, { status: 404, message: 'Collection not found' });
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to add this entity'
      );
      await db.view.addCollectionEntity(authCtx.userId, ws, collectionId, entity.id, new Date());
      return { success: true, message: 'Entity added to collection' };
    }
  });
};

export const removeEntityFromCollection = async (
  db: DatabaseAdapter,
  workspace: string,
  collectionId: string,
  entityId: string,
  event: AuthenticatedEvent
) => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const collection = await db.view.getCollection(authCtx.userId, ws, collectionId);
      httpAssert.present(collection, { status: 404, message: 'Collection not found' });
      await db.view.removeCollectionEntity(authCtx.userId, ws, collectionId, entityId);
      return { success: true, message: 'Entity removed from collection' };
    }
  });
};
