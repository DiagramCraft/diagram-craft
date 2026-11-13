import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runDraftOperation } from './draftOperation';
import { httpAssert } from '../../utils/httpAssert';
import { logAudit } from '../audit/db/auditLogging';
import type {
  PublishSchemaDraftBody,
  SchemaDraft,
  SchemaPublication,
  SchemaSnapshotVersion
} from '@arch-register/api-types/schemaDraftContract';
import type {
  SchemaDraftItemDbResult,
  SchemaDraftKind,
  SchemaPublicationDbResult,
  SnapshotVersionDbResult,
  SnapshotVersionKind
} from './db/schemaDraftDatabase';
import {
  analyzeSchemaDraft,
  getLiveVersion,
  stageSchemaDraftItemInternal
} from './schemaDraftOperations';
import { createLogger } from '../../utils/logger';
import { revisionConflictError } from './revisionConflict';
import { recalculateEntityDerivedFields } from '../derived/derivedRecalculation';
import { ensureDerivedRecalculationScheduleExists } from '../derived/derivedRecalculationJob';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import {
  ENTITY_COMPLETENESS_JOB_TYPE,
  ENTITY_COMPLETENESS_SYSTEM_IDENTITY,
  ensureEntityCompletenessScanScheduleExists
} from '../catalog/entityCompletenessJob';
import {
  applyCreateCategory,
  applyDeleteCategory,
  applyUpdateCategory
} from '../catalog/categoryOperations';
import { applyCreateEnum, applyDeleteEnum, applyUpdateEnum } from '../catalog/enumOperations';
import {
  applyCreateSharedFieldGroup,
  applyDeleteSharedFieldGroup,
  applyUpdateSharedFieldGroup
} from '../catalog/fieldGroupOperations';
import {
  applyCreateSchema,
  applyDeleteSchema,
  applyUpdateSchema
} from '../catalog/schemaOperations';
import {
  applyCreateRelationSchema,
  applyDeleteRelationSchema,
  applyUpdateRelationSchema
} from '../catalog/relationSchemaOperations';
import {
  applyCreateDocumentType,
  applyDeleteDocumentType,
  applyUpdateDocumentType
} from '../document/documentOperations';

const logger = createLogger('schema-draft-publish');

/** Creates and updates run in this order; deletes run afterwards in the reverse order. */
const APPLY_ORDER: SchemaDraftKind[] = [
  'category',
  'enum',
  'field_group',
  'entity_schema',
  'relation_schema',
  'document_type'
];

type ApplyContext = {
  userId: string;
  publicationId: string;
};

type Payload = Record<string, unknown>;

type ApplyArgs = {
  tx: DatabaseAdapter;
  ws: string;
  id: string;
  payload: Payload;
  /** Context for kinds that have no derived-field recalculation of their own. */
  ctx: ApplyContext;
  /** Like `ctx`, but defers derived recalculation and scheduling to the end of the publication. */
  writeCtx: ApplyContext & { skipRecalc: true };
};

type Applier = {
  create: (args: ApplyArgs) => Promise<unknown>;
  update: (args: ApplyArgs) => Promise<unknown>;
  delete: (args: ApplyArgs) => Promise<unknown>;
};

// Payloads were validated against the kind's write schema when they were staged.
const APPLIERS: Record<SchemaDraftKind, Applier> = {
  category: {
    create: ({ tx, ws, id, payload, ctx }) =>
      applyCreateCategory(tx, ws, { id, name: String(payload['name'] ?? '') }, ctx),
    update: ({ tx, ws, id, payload, ctx }) =>
      applyUpdateCategory(tx, ws, id, { name: String(payload['name'] ?? '') }, ctx),
    delete: ({ tx, ws, id }) => applyDeleteCategory(tx, ws, id)
  },
  enum: {
    create: ({ tx, ws, id, payload, ctx }) =>
      applyCreateEnum(tx, ws, payload as never, { ...ctx, id }),
    update: ({ tx, ws, id, payload, ctx }) => applyUpdateEnum(tx, ws, id, payload as never, ctx),
    delete: ({ tx, ws, id, ctx }) => applyDeleteEnum(tx, ws, id, ctx)
  },
  field_group: {
    create: ({ tx, ws, id, payload, writeCtx }) =>
      applyCreateSharedFieldGroup(tx, ws, payload as never, { ...writeCtx, id }),
    update: ({ tx, ws, id, payload, writeCtx }) =>
      applyUpdateSharedFieldGroup(tx, ws, id, payload as never, writeCtx),
    delete: ({ tx, ws, id }) => applyDeleteSharedFieldGroup(tx, ws, id)
  },
  entity_schema: {
    create: ({ tx, ws, id, payload, writeCtx }) =>
      applyCreateSchema(tx, ws, payload as never, { ...writeCtx, id }),
    update: ({ tx, ws, id, payload, writeCtx }) =>
      applyUpdateSchema(tx, ws, id, payload as never, writeCtx),
    delete: ({ tx, ws, id, writeCtx }) => applyDeleteSchema(tx, ws, id, writeCtx)
  },
  relation_schema: {
    create: ({ tx, ws, id, payload, writeCtx }) =>
      applyCreateRelationSchema(tx, ws, payload as never, { ...writeCtx, id }),
    update: ({ tx, ws, id, payload, writeCtx }) =>
      applyUpdateRelationSchema(tx, ws, id, payload as never, writeCtx),
    delete: ({ tx, ws, id, writeCtx }) => applyDeleteRelationSchema(tx, ws, id, writeCtx)
  },
  document_type: {
    create: ({ tx, ws, id, payload, ctx }) =>
      applyCreateDocumentType(tx, ws, id, payload as never, ctx),
    update: ({ tx, ws, id, payload, ctx }) =>
      applyUpdateDocumentType(tx, ws, id, payload as never, ctx),
    delete: ({ tx, ws, id }) => applyDeleteDocumentType(tx, ws, id)
  }
};

const applyItem = async (
  tx: DatabaseAdapter,
  ws: string,
  item: SchemaDraftItemDbResult,
  ctx: ApplyContext
): Promise<void> => {
  await APPLIERS[item.kind][item.op]({
    tx,
    ws,
    id: item.item_id,
    payload: (item.payload ?? {}) as Payload,
    ctx,
    writeCtx: { ...ctx, skipRecalc: true }
  });
};

const orderItems = (items: SchemaDraftItemDbResult[]) => {
  const rank = (kind: SchemaDraftKind) => APPLY_ORDER.indexOf(kind);
  const writes = items
    .filter(item => item.op !== 'delete')
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.item_id.localeCompare(b.item_id));
  const deletes = items
    .filter(item => item.op === 'delete')
    .sort((a, b) => rank(b.kind) - rank(a.kind) || a.item_id.localeCompare(b.item_id));
  return [...writes, ...deletes];
};

const toApiPublication = (row: SchemaPublicationDbResult): SchemaPublication => ({
  id: row.id,
  number: row.number,
  summary: row.summary,
  author: row.author,
  publishedAt: row.published_at.toISOString(),
  items: row.items as SchemaPublication['items'],
  migrationDetails: row.migration_details as SchemaPublication['migrationDetails']
});

export const publishSchemaDraft = async (
  db: DatabaseAdapter,
  workspace: string,
  body: PublishSchemaDraftBody,
  event: AuthenticatedEvent
): Promise<SchemaPublication> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to publish schema draft',
    access: 'schema.publish',
    operation: async ({ ws, authCtx }) => {
      const [draft, storedItems] = await Promise.all([
        db.schemaDraft.getDraft(ws),
        db.schemaDraft.listItems(ws)
      ]);
      httpAssert.true(draft !== null && storedItems.length > 0, {
        status: 404,
        message: 'There is no schema draft to publish'
      });
      httpAssert.true(draft!.revision === body.expectedRevision, revisionConflictError());

      // Migration decisions supplied with the request override those staged on the item.
      const items = storedItems.map(item => ({ ...item }));
      for (const decision of body.migrationDecisions) {
        const target = items.find(i => i.kind === decision.kind && i.item_id === decision.itemId);
        httpAssert.present(target, {
          status: 400,
          message: `Migration decision for ${decision.kind} '${decision.itemId}' does not match a draft item`
        });
        target.payload = {
          ...((target.payload ?? {}) as Payload),
          fieldMigrations: decision.fieldMigrations
        };
      }

      // Re-run the review against the live catalog and refuse while anything blocks publishing.
      const { catalog, migrations, findings } = await analyzeSchemaDraft(db, ws, items);
      const blocking = findings.filter(f => f.severity === 'blocking');
      httpAssert.true(blocking.length === 0, {
        status: 409,
        message: `Cannot publish: ${blocking.length} blocking conflict(s) remain (${blocking
          .slice(0, 3)
          .map(f => f.message)
          .join('; ')})`,
        data: { code: 'SCHEMA_DRAFT_BLOCKED', findings: blocking }
      });
      const hardBlocked = migrations.filter(m => m.hardBlocks.length > 0);
      httpAssert.true(hardBlocked.length === 0, {
        status: 409,
        message: `Cannot publish: changes that cannot be applied while records exist (${hardBlocked
          .map(m => m.name)
          .join(', ')})`,
        data: { code: 'SCHEMA_DRAFT_BLOCKED' }
      });
      const unresolved = migrations.filter(m => m.unresolved.length > 0);
      httpAssert.true(unresolved.length === 0, {
        status: 409,
        message: `Cannot publish: migration decisions are required (${unresolved
          .map(m => m.name)
          .join(', ')})`,
        data: { code: 'SCHEMA_MIGRATION_REQUIRED' }
      });

      const now = new Date();
      const userId = authCtx.userId;
      const publication = await db.core.transaction(async tx => {
        // Anything staged since the review bumps the revision, so this also guards `items`.
        const current = await tx.schemaDraft.getDraft(ws);
        httpAssert.true(current?.revision === body.expectedRevision, revisionConflictError());

        // The live item must be exactly as it was when the draft first diverged from it.
        for (const item of items) {
          const live = await getLiveVersion(tx, ws, item.kind, item.item_id);
          if (item.op === 'create') {
            httpAssert.true(live === null, {
              status: 409,
              message: `Cannot publish: ${item.kind} '${item.item_id}' now exists in the live catalog`,
              data: { code: 'LIVE_ITEM_CHANGED', kind: item.kind, itemId: item.item_id }
            });
          } else {
            httpAssert.true(live !== null && live === item.base_version, {
              status: 409,
              message: `Cannot publish: ${item.kind} '${item.item_id}' was changed after it was staged`,
              data: { code: 'LIVE_ITEM_CHANGED', kind: item.kind, itemId: item.item_id }
            });
          }
        }

        const created = await tx.schemaDraft.createPublication({
          workspace: ws,
          summary: body.summary,
          author: userId,
          migration_details: migrations.map(m => ({
            kind: m.kind,
            itemId: m.itemId,
            name: m.name,
            recordCount: m.recordCount,
            fieldMigrations:
              (
                (items.find(i => i.kind === m.kind && i.item_id === m.itemId)?.payload ??
                  null) as Payload | null
              )?.['fieldMigrations'] ?? null,
            changes: m.resolved
          })),
          items: catalog.changes.map(change => ({
            kind: change.kind,
            itemId: change.itemId,
            op: change.op,
            name: change.op === 'delete' ? null : change.name
          }))
        });

        const ctx: ApplyContext = { userId, publicationId: created.id };
        for (const item of orderItems(items)) {
          await applyItem(tx, ws, item, ctx);
        }
        await recalculateEntityDerivedFields(tx, ws);

        const discarded = await tx.schemaDraft.discard(ws, body.expectedRevision);
        httpAssert.true(discarded, revisionConflictError());

        await logAudit(tx, {
          userId,
          workspace: ws,
          operation: 'create',
          entityType: 'schema_publication',
          entityId: created.id,
          entityName: `Schema publication #${created.number}`,
          changes: { new: { number: created.number, summary: created.summary } },
          metadata: { itemCount: items.length }
        });
        return created;
      });

      // The publication is committed; a failure to schedule follow-up work must not fail it.
      const updatedSchemaIds = items
        .filter(item => item.kind === 'entity_schema' && item.op === 'update')
        .map(item => item.item_id);
      try {
        await ensureDerivedRecalculationScheduleExists(db, ws, now);
        if (updatedSchemaIds.length > 0) {
          await ensureEntityCompletenessScanScheduleExists(db, ws, now);
        }
        for (const schemaId of updatedSchemaIds) {
          await enqueueOneOffJobRun(
            db,
            {
              workspace: ws,
              jobType: ENTITY_COMPLETENESS_JOB_TYPE,
              systemIdentity: ENTITY_COMPLETENESS_SYSTEM_IDENTITY,
              payload: { schemaId }
            },
            now
          );
        }
      } catch (error) {
        logger.warn('Failed to schedule follow-up jobs after schema publication', {
          workspace: ws,
          publicationId: publication.id,
          error
        });
      }

      return toApiPublication(publication);
    }
  });

export const listSchemaPublications = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<SchemaPublication[]> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to list schema publications',
    access: 'read',
    operation: async ({ ws }) => {
      return (await db.schemaDraft.listPublications(ws)).map(toApiPublication);
    }
  });

export const getSchemaPublication = async (
  db: DatabaseAdapter,
  workspace: string,
  number: number,
  event: AuthenticatedEvent
): Promise<SchemaPublication> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to load schema publication',
    access: 'read',
    operation: async ({ ws }) => {
      const row = await db.schemaDraft.getPublication(ws, number);
      httpAssert.present(row, { status: 404, message: `Publication #${number} not found` });
      return toApiPublication(row);
    }
  });

const toApiSnapshotVersion = (row: SnapshotVersionDbResult): SchemaSnapshotVersion => ({
  version: row.version,
  snapshot: row.snapshot,
  changeSummary: row.change_summary,
  publicationId: row.publication_id,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString()
});

export const listSnapshotVersions = async (
  db: DatabaseAdapter,
  workspace: string,
  kind: SnapshotVersionKind,
  itemId: string,
  event: AuthenticatedEvent
): Promise<SchemaSnapshotVersion[]> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to list versions',
    access: 'read',
    operation: async ({ ws }) => {
      return (await db.schemaDraft.listSnapshotVersions(kind, ws, itemId)).map(
        toApiSnapshotVersion
      );
    }
  });

/**
 * Turns a stored version row into the body of a draft update/create that restores it.
 * Data migrations are never reversed; the regular review flags any field changes that need them.
 */
const versionToPayload = async (
  db: DatabaseAdapter,
  ws: string,
  kind: SchemaDraftKind,
  itemId: string,
  version: number
): Promise<Payload> => {
  const notFound = () =>
    httpAssert.present(null, {
      status: 404,
      message: `Version ${version} of ${kind} '${itemId}' not found`
    });
  const categoryIdByName = async (name: string | null | undefined) => {
    if (!name) return null;
    const categories = await db.catalog.listCategories(ws);
    return categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  };

  switch (kind) {
    case 'entity_schema': {
      const row = (await db.catalog.listSchemaVersions(ws, itemId)).find(
        v => v.version === version
      );
      if (!row) return notFound() as never;
      return {
        name: row.name,
        category_id: await categoryIdByName(row.category),
        description: row.description,
        fields: row.fields,
        templates: row.templates,
        groups: row.groups,
        shared_field_group_links: row.shared_field_group_links,
        validation_rules: row.validation_rules ?? [],
        color: row.color,
        icon: row.icon
      };
    }
    case 'relation_schema': {
      const row = (await db.relation.listRelationSchemaVersions(ws, itemId)).find(
        v => v.version === version
      );
      if (!row) return notFound() as never;
      return {
        name: row.name,
        category_id: await categoryIdByName(row.category),
        description: row.description,
        in: { schemaIds: row.in_schema_ids, label: row.in_label ?? undefined },
        out: { schemaIds: row.out_schema_ids, label: row.out_label ?? undefined },
        fields: row.fields,
        groups: row.groups,
        validation_rules: row.validation_rules ?? [],
        color: row.color,
        icon: row.icon,
        unique_endpoint_pair: row.unique_endpoint_pair ?? false
      };
    }
    case 'document_type': {
      const row = (await db.document.listDocumentTypeVersions(ws, itemId)).find(
        v => v.version === version
      );
      if (!row) return notFound() as never;
      return {
        name: row.name,
        description: row.description,
        fields: row.fields,
        aiActions: row.aiActions,
        color: row.color,
        icon: row.icon
      };
    }
    case 'enum':
    case 'field_group':
    case 'category': {
      const row = await db.schemaDraft.getSnapshotVersion(kind, ws, itemId, version);
      if (!row) return notFound() as never;
      const snapshot = row.snapshot as Payload;
      if (kind === 'category') return { name: snapshot['name'] };
      // Stored rows carry bookkeeping columns the write schemas do not accept.
      const { id: _id, workspace: _ws, created_at, updated_at, ...rest } = snapshot;
      void created_at;
      void updated_at;
      return rest;
    }
  }
};

/** Stages a draft item that restores `kind`/`itemId` to a previously published version. */
export const stageSchemaDraftFromVersion = async (
  db: DatabaseAdapter,
  workspace: string,
  body: {
    expectedRevision: number;
    kind: SchemaDraftKind;
    itemId: string;
    version: number;
  },
  event: AuthenticatedEvent
): Promise<SchemaDraft> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to stage rollback',
    access: 'schema.edit',
    operation: async ({ ws, authCtx }) => {
      const payload = await versionToPayload(db, ws, body.kind, body.itemId, body.version);
      // A deleted item is restored as a create with its original id.
      const exists = (await getLiveVersion(db, ws, body.kind, body.itemId)) !== null;
      return stageSchemaDraftItemInternal(db, ws, authCtx.userId, body.kind, body.itemId, {
        expectedRevision: body.expectedRevision,
        op: exists ? 'update' : 'create',
        payload
      });
    }
  });
