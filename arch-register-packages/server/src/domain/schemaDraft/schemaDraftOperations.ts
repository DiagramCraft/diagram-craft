import type { z } from 'zod';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { logAudit } from '../audit/db/auditLogging';
import type {
  SchemaChangeMode,
  SchemaDraftDbResult,
  SchemaDraftItemDbResult,
  SchemaDraftKind,
  SchemaDraftOp
} from './db/schemaDraftDatabase';
import {
  createSchemaBodySchema,
  updateSchemaBodySchema
} from '@arch-register/api-types/schemaContract';
import {
  createRelationSchemaBodySchema,
  updateRelationSchemaBodySchema
} from '@arch-register/api-types/relationSchemaContract';
import { createEnumBodySchema } from '@arch-register/api-types/enumContract';
import {
  sharedFieldGroupBodySchema,
  updateSharedFieldGroupBodySchema
} from '@arch-register/api-types/fieldGroupContract';
import { categoryBodySchema } from '@arch-register/api-types/categoryContract';
import { documentTypeWriteSchema } from '@arch-register/api-types/documentContract';
import type { SchemaDraft } from '@arch-register/api-types/schemaDraftContract';

const REVISION_CONFLICT = 'The schema draft was changed by someone else; reload it and try again';

const PAYLOAD_SCHEMAS: Record<SchemaDraftKind, { create: z.ZodType; update: z.ZodType }> = {
  entity_schema: { create: createSchemaBodySchema, update: updateSchemaBodySchema },
  relation_schema: {
    create: createRelationSchemaBodySchema,
    update: updateRelationSchemaBodySchema
  },
  document_type: { create: documentTypeWriteSchema, update: documentTypeWriteSchema },
  enum: { create: createEnumBodySchema, update: createEnumBodySchema },
  field_group: { create: sharedFieldGroupBodySchema, update: updateSharedFieldGroupBodySchema },
  category: { create: categoryBodySchema, update: categoryBodySchema }
};

/**
 * Returns the live row's version token, or `null` when the item does not exist. Kinds without a
 * version counter use their updated_at timestamp, which publish re-checks the same way.
 */
const getLiveVersion = async (
  db: DatabaseAdapter,
  ws: string,
  kind: SchemaDraftKind,
  id: string
): Promise<string | null> => {
  switch (kind) {
    case 'entity_schema': {
      const row = await db.catalog.getSchema(ws, id);
      return row ? String(row.version) : null;
    }
    case 'relation_schema': {
      const row = await db.relation.getRelationSchema(ws, id);
      return row ? String(row.version) : null;
    }
    case 'document_type': {
      const row = await db.document.getDocumentType(ws, id);
      return row ? String(row.version) : null;
    }
    case 'enum': {
      const row = await db.catalog.getEnum(ws, id);
      return row ? row.updated_at.toISOString() : null;
    }
    case 'field_group': {
      const row = await db.catalog.getSharedFieldGroup(ws, id);
      return row ? row.updated_at.toISOString() : null;
    }
    case 'category': {
      const row = await db.catalog.getCategory(ws, id);
      return row ? row.updated_at.toISOString() : null;
    }
  }
};

const toApiItem = (item: SchemaDraftItemDbResult): SchemaDraft['items'][number] => ({
  kind: item.kind,
  item_id: item.item_id,
  op: item.op,
  payload: item.payload,
  base_version: item.base_version,
  updated_by: item.updated_by,
  updated_at: item.updated_at.toISOString()
});

const toApiDraft = (
  draft: SchemaDraftDbResult | null,
  items: SchemaDraftItemDbResult[]
): SchemaDraft => ({
  revision: draft?.revision ?? 0,
  created_by: draft?.created_by ?? null,
  updated_by: draft?.updated_by ?? null,
  created_at: draft?.created_at.toISOString() ?? null,
  updated_at: draft?.updated_at.toISOString() ?? null,
  items: items.map(toApiItem)
});

const loadDraft = async (db: DatabaseAdapter, ws: string) => {
  const [draft, items] = await Promise.all([
    db.schemaDraft.getDraft(ws),
    db.schemaDraft.listItems(ws)
  ]);
  return toApiDraft(draft, items);
};

export const getSchemaDraft = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<SchemaDraft> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to load schema draft',
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      return loadDraft(db, ws);
    }
  });

export const stageSchemaDraftItem = async (
  db: DatabaseAdapter,
  workspace: string,
  kind: SchemaDraftKind,
  itemId: string,
  body: { expectedRevision: number; op: SchemaDraftOp; payload?: unknown },
  event: AuthenticatedEvent
): Promise<SchemaDraft> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to stage schema change',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');

      let payload: unknown | null = null;
      if (body.op !== 'delete') {
        const parsed = PAYLOAD_SCHEMAS[kind][body.op].safeParse(body.payload);
        httpAssert.true(parsed.success, {
          status: 400,
          message: `Invalid ${kind} payload: ${parsed.success ? '' : parsed.error.message}`
        });
        payload = parsed.success ? parsed.data : null;
      }

      const liveVersion = await getLiveVersion(db, ws, kind, itemId);
      if (body.op === 'create') {
        httpAssert.true(liveVersion === null, {
          status: 409,
          message: `A ${kind} with id '${itemId}' already exists`
        });
      } else {
        httpAssert.true(liveVersion !== null, {
          status: 404,
          message: `${kind} '${itemId}' not found`
        });
      }

      // The base version is fixed when an item is first staged, so publish can detect live
      // changes made after the draft diverged.
      const existing = (await db.schemaDraft.listItems(ws)).find(
        i => i.kind === kind && i.item_id === itemId
      );
      const baseVersion = body.op === 'create' ? null : (existing?.base_version ?? liveVersion);

      const result = await db.core.transaction(async tx => {
        const draft = await tx.schemaDraft.stageItem(
          {
            workspace: ws,
            kind,
            item_id: itemId,
            op: body.op,
            payload,
            base_version: baseVersion,
            updated_by: authCtx.userId ?? null
          },
          body.expectedRevision
        );
        httpAssert.present(draft, { status: 409, message: REVISION_CONFLICT });
        await logAudit(tx, {
          userId: authCtx.userId,
          workspace: ws,
          operation: 'update',
          entityType: 'schema_draft',
          entityId: ws,
          entityName: 'Schema draft',
          changes: {},
          metadata: { action: 'stage', kind, itemId, op: body.op, revision: draft.revision }
        });
        return loadDraft(tx, ws);
      });
      return result;
    }
  });

export const unstageSchemaDraftItem = async (
  db: DatabaseAdapter,
  workspace: string,
  kind: SchemaDraftKind,
  itemId: string,
  expectedRevision: number,
  event: AuthenticatedEvent
): Promise<SchemaDraft> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to unstage schema change',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return db.core.transaction(async tx => {
        const items = await tx.schemaDraft.listItems(ws);
        const draftExists = (await tx.schemaDraft.getDraft(ws)) !== null;
        httpAssert.true(draftExists && items.some(i => i.kind === kind && i.item_id === itemId), {
          status: 404,
          message: `No staged ${kind} '${itemId}' in the schema draft`
        });
        const draft = await tx.schemaDraft.unstageItem(
          ws,
          kind,
          itemId,
          expectedRevision,
          authCtx.userId ?? null
        );
        httpAssert.present(draft, { status: 409, message: REVISION_CONFLICT });
        await logAudit(tx, {
          userId: authCtx.userId,
          workspace: ws,
          operation: 'update',
          entityType: 'schema_draft',
          entityId: ws,
          entityName: 'Schema draft',
          changes: {},
          metadata: { action: 'unstage', kind, itemId, revision: draft.revision }
        });
        return loadDraft(tx, ws);
      });
    }
  });

export const discardSchemaDraft = async (
  db: DatabaseAdapter,
  workspace: string,
  expectedRevision: number,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to discard schema draft',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return db.core.transaction(async tx => {
        httpAssert.true(expectedRevision > 0 && (await tx.schemaDraft.getDraft(ws)) !== null, {
          status: 404,
          message: 'There is no schema draft to discard'
        });
        const discarded = await tx.schemaDraft.discard(ws, expectedRevision);
        httpAssert.true(discarded, { status: 409, message: REVISION_CONFLICT });
        await logAudit(tx, {
          userId: authCtx.userId,
          workspace: ws,
          operation: 'delete',
          entityType: 'schema_draft',
          entityId: ws,
          entityName: 'Schema draft',
          changes: {},
          metadata: { action: 'discard', revision: expectedRevision }
        });
        return { success: true };
      });
    }
  });

export const getSchemaChangeMode = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<{ schemaChangeMode: SchemaChangeMode }> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to load schema change mode',
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      return { schemaChangeMode: await db.schemaDraft.getSchemaChangeMode(ws) };
    }
  });

export const setSchemaChangeMode = async (
  db: DatabaseAdapter,
  workspace: string,
  mode: SchemaChangeMode,
  event: AuthenticatedEvent
): Promise<{ schemaChangeMode: SchemaChangeMode }> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to set schema change mode',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const previous = await db.schemaDraft.getSchemaChangeMode(ws);
      await db.schemaDraft.setSchemaChangeMode(ws, mode, authCtx.userId ?? null);
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'schema_draft',
        entityId: ws,
        entityName: 'Schema draft',
        changes: { old: { schemaChangeMode: previous }, new: { schemaChangeMode: mode } },
        metadata: { action: 'set_mode' }
      });
      return { schemaChangeMode: mode };
    }
  });
