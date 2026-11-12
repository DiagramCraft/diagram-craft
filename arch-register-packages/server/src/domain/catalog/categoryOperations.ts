import { assertDirectSchemaChangeMode } from '../schemaDraft/schemaChangeMode';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { recordSnapshotVersion } from '../schemaDraft/snapshotVersions';
import type { CategoryDbResult } from './db/catalogDatabase';
import type { Category } from '@arch-register/api-types/categoryContract';
import type { CategoryLookup } from './schemaHelpers';

/** Builds the workspace's category id -> name lookup used to embed `{id, name}` refs in responses. */
export const buildCategoryLookup = async (
  db: DatabaseAdapter,
  ws: string
): Promise<CategoryLookup> => {
  const categories = await db.catalog.listCategories(ws);
  return new Map(categories.map(category => [category.id, category.name]));
};

const toApiCategory = (category: CategoryDbResult): Category => ({
  id: category.id,
  workspaceId: category.workspace,
  name: category.name,
  createdAt: category.created_at.toISOString(),
  updatedAt: category.updated_at.toISOString()
});

type CategoryApplyContext = {
  userId: string;
  /** Set when applied as part of a schema draft publication. */
  publicationId?: string | null;
};

const recordCategoryVersion = (
  db: DatabaseAdapter,
  ws: string,
  row: CategoryDbResult,
  ctx: CategoryApplyContext,
  baseline?: CategoryDbResult
) => recordSnapshotVersion(db, 'category', ws, row, ctx, baseline);

/**
 * Authorization-free category writes. They are shared by the direct operations below and by
 * schema draft publish, which calls them with its transaction handle.
 */
export const applyCreateCategory = async (
  db: DatabaseAdapter,
  ws: string,
  input: { id: string; name: string },
  ctx: CategoryApplyContext
): Promise<CategoryDbResult> => {
  const normalizedName = input.name.trim();
  httpAssert.true(normalizedName, { status: 400, message: 'Category name is required' });
  const existing = await db.catalog.getCategoryByName(ws, normalizedName);
  httpAssert.true(!existing, {
    status: 409,
    message: 'A category with this name already exists'
  });
  const now = new Date();
  const row = await db.catalog.createCategory({
    id: input.id,
    workspace: ws,
    name: normalizedName,
    created_at: now,
    updated_at: now
  });
  await recordCategoryVersion(db, ws, row, ctx);
  return row;
};

export const applyUpdateCategory = async (
  db: DatabaseAdapter,
  ws: string,
  id: string,
  input: { name: string },
  ctx: CategoryApplyContext
): Promise<CategoryDbResult> => {
  const normalizedName = input.name.trim();
  httpAssert.true(normalizedName, { status: 400, message: 'Category name is required' });
  const existing = await db.catalog.getCategoryByName(ws, normalizedName);
  httpAssert.true(!existing || existing.id === id, {
    status: 409,
    message: 'A category with this name already exists'
  });
  const before = await db.catalog.getCategory(ws, id);
  const updated = await db.catalog.updateCategory(ws, id, {
    name: normalizedName,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Category not found' });
  await recordCategoryVersion(db, ws, updated, ctx, before ?? undefined);
  return updated;
};

export const applyDeleteCategory = async (db: DatabaseAdapter, ws: string, id: string) => {
  const usageCount = await db.catalog.countCategoryUsage(ws, id);
  httpAssert.true(usageCount === 0, {
    status: 409,
    message: 'Category is not empty and cannot be deleted'
  });
  const deleted = await db.catalog.deleteCategory(ws, id);
  httpAssert.present(deleted, { status: 404, message: 'Category not found' });
};

export const listCategories = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const categories = await db.catalog.listCategories(ws);
      return categories.map(toApiCategory);
    }
  });
};

export const createCategory = async (
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
      requireWorkspaceCapability(authCtx, 'schema.edit');
      await assertDirectSchemaChangeMode(db, ws);
      return toApiCategory(
        await applyCreateCategory(db, ws, { id: randomUUID(), name }, { userId: authCtx.userId })
      );
    }
  });
};

export const updateCategory = async (
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
      requireWorkspaceCapability(authCtx, 'schema.edit');
      await assertDirectSchemaChangeMode(db, ws);
      return toApiCategory(
        await applyUpdateCategory(db, ws, id, { name }, { userId: authCtx.userId })
      );
    }
  });
};

/**
 * Validates a category_id (if provided) references a real category in the workspace, returning
 * its current name — used both to reject an unknown id and to resolve the free-text name stored
 * in *_version snapshot tables.
 */
export const assertCategoryExists = async (
  db: DatabaseAdapter,
  ws: string,
  categoryId: string | null | undefined
): Promise<string | null> => {
  if (!categoryId) return null;
  const category = await db.catalog.getCategory(ws, categoryId);
  httpAssert.present(category, { status: 400, message: 'Category not found' });
  return category.name;
};

export const deleteCategory = async (
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
      requireWorkspaceCapability(authCtx, 'schema.edit');
      await assertDirectSchemaChangeMode(db, ws);
      await applyDeleteCategory(db, ws, id);
      return { success: true, message: 'Category deleted' };
    }
  });
};
