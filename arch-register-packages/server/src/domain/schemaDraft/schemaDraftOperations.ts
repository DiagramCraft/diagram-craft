import type { z } from 'zod';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runDraftOperation, logDraftAudit } from './draftOperation';
import { httpAssert } from '../../utils/httpAssert';
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
import type { SchemaDraft, SchemaDraftReview } from '@arch-register/api-types/schemaDraftContract';
import { analyzeDraftIntegrations } from './draftIntegrationAnalysis';
import { buildDraftCatalog } from './draftCatalog';
import { buildMigrationReport } from './draftMigrationReport';
import { analyzeDraftDependencies, type QueryConsumer } from './draftDependencyAnalyzer';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import {
  SCHEMA_DRAFT_REVIEW_JOB_TYPE,
  SCHEMA_DRAFT_REVIEW_SYSTEM_IDENTITY
} from './schemaDraftReviewJob';
import { createMigrationUsageProvider } from './draftMigrationUsage';
import { revisionConflictError } from './revisionConflict';

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
export const getLiveVersion = async (
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
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to load schema draft',
    access: 'read',
    operation: async ({ ws }) => {
      return loadDraft(db, ws);
    }
  });

/** Validates and stages a draft item. Callers are responsible for authorization. */
export const stageSchemaDraftItemInternal = async (
  db: DatabaseAdapter,
  ws: string,
  userId: string,
  kind: SchemaDraftKind,
  itemId: string,
  body: { expectedRevision: number; op: SchemaDraftOp; payload?: unknown }
): Promise<SchemaDraft> => {
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

  return db.core.transaction(async tx => {
    const draft = await tx.schemaDraft.stageItem(
      {
        workspace: ws,
        kind,
        item_id: itemId,
        op: body.op,
        payload,
        base_version: baseVersion,
        updated_by: userId
      },
      body.expectedRevision
    );
    httpAssert.present(draft, revisionConflictError());
    await logDraftAudit(tx, {
      userId,
      workspace: ws,
      operation: 'update',
      metadata: { action: 'stage', kind, itemId, op: body.op, revision: draft.revision }
    });
    return loadDraft(tx, ws);
  });
};

export const stageSchemaDraftItem = async (
  db: DatabaseAdapter,
  workspace: string,
  kind: SchemaDraftKind,
  itemId: string,
  body: { expectedRevision: number; op: SchemaDraftOp; payload?: unknown },
  event: AuthenticatedEvent
): Promise<SchemaDraft> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to stage schema change',
    access: 'schema.edit',
    operation: async ({ ws, authCtx }) => {
      return stageSchemaDraftItemInternal(db, ws, authCtx.userId, kind, itemId, body);
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
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to unstage schema change',
    access: 'schema.edit',
    operation: async ({ ws, authCtx }) => {
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
          authCtx.userId
        );
        httpAssert.present(draft, revisionConflictError());
        await logDraftAudit(tx, {
          userId: authCtx.userId,
          workspace: ws,
          operation: 'update',
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
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to discard schema draft',
    access: 'schema.edit',
    operation: async ({ ws, authCtx }) => {
      return db.core.transaction(async tx => {
        httpAssert.true(expectedRevision > 0 && (await tx.schemaDraft.getDraft(ws)) !== null, {
          status: 404,
          message: 'There is no schema draft to discard'
        });
        const discarded = await tx.schemaDraft.discard(ws, expectedRevision);
        httpAssert.true(discarded, revisionConflictError());
        await logDraftAudit(tx, {
          userId: authCtx.userId,
          workspace: ws,
          operation: 'delete',
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
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to load schema change mode',
    access: 'read',
    operation: async ({ ws }) => {
      return { schemaChangeMode: await db.schemaDraft.getSchemaChangeMode(ws) };
    }
  });

export const setSchemaChangeMode = async (
  db: DatabaseAdapter,
  workspace: string,
  mode: SchemaChangeMode,
  event: AuthenticatedEvent
): Promise<{ schemaChangeMode: SchemaChangeMode }> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to set schema change mode',
    access: 'schema.edit',
    operation: async ({ ws, authCtx }) => {
      const previous = await db.schemaDraft.getSchemaChangeMode(ws);
      await db.schemaDraft.setSchemaChangeMode(ws, mode, authCtx.userId);
      await logDraftAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        changes: { old: { schemaChangeMode: previous }, new: { schemaChangeMode: mode } },
        metadata: { action: 'set_mode' }
      });
      return { schemaChangeMode: mode };
    }
  });

/**
 * Shared by review and publish: builds the draft catalog and derives migrations and findings from
 * it. Read-only.
 */
export const analyzeSchemaDraft = async (
  db: DatabaseAdapter,
  ws: string,
  items: SchemaDraftItemDbResult[]
) => {
  const catalog = await buildDraftCatalog(db, ws, items);

  const payloads = new Map(
    items.map(item => [
      `${item.kind}:${item.item_id}`,
      (item.payload ?? {}) as { fieldMigrations?: never }
    ])
  );
  const migrations = await buildMigrationReport(
    catalog,
    payloads,
    createMigrationUsageProvider(db, ws)
  );

  // Workspace views plus every project's own views.
  const projects = await db.project.projects.listProjects(ws);
  const viewLists = await Promise.all([
    db.view.listSavedViews(ws, { includeWorkspace: true }),
    ...projects.map(project => db.view.listSavedViews(ws, { projectId: project.id }))
  ]);
  const views = [...new Map(viewLists.flat().map(view => [view.id, view])).values()];
  const queryConsumers: QueryConsumer[] = views.map(view => ({
    type: 'saved_view',
    id: view.id,
    name: view.name,
    query: view.filters
  }));
  const findings = [
    ...analyzeDraftDependencies(catalog, { queryConsumers }),
    ...(await analyzeDraftIntegrations(db, ws, catalog))
  ];
  return { catalog, migrations, findings };
};

/**
 * Computes the impact of the draft against the live catalog and data. Strictly read-only.
 */
export const reviewSchemaDraft = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<SchemaDraftReview> =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to review schema draft',
    access: 'schema.edit',
    operation: async ({ ws }) => {
      const [draft, items] = await Promise.all([
        db.schemaDraft.getDraft(ws),
        db.schemaDraft.listItems(ws)
      ]);
      const { catalog, migrations, findings } = await analyzeSchemaDraft(db, ws, items);

      const revision = draft?.revision ?? 0;
      const run = await enqueueOneOffJobRun(db, {
        workspace: ws,
        jobType: SCHEMA_DRAFT_REVIEW_JOB_TYPE,
        systemIdentity: SCHEMA_DRAFT_REVIEW_SYSTEM_IDENTITY,
        payload: { revision }
      });

      return {
        revision,
        recordValidation: { jobRunId: run.id },
        items: catalog.changes,
        migrations,
        findings,
        summary: {
          blocking: findings.filter(f => f.severity === 'blocking').length,
          warnings: findings.filter(f => f.severity === 'warning').length,
          unresolvedMigrations: migrations.reduce((n, m) => n + m.unresolved.length, 0),
          hardBlockedMigrations: migrations.reduce((n, m) => n + m.hardBlocks.length, 0)
        }
      };
    }
  });

export const getSchemaDraftRecordReview = async (
  db: DatabaseAdapter,
  workspace: string,
  jobRunId: string,
  event: AuthenticatedEvent
) =>
  runDraftOperation({
    db,
    event,
    workspace,
    fallback: 'Failed to load record validation',
    access: 'schema.edit',
    operation: async ({ ws }) => {
      const found = await db.jobs.getRun(jobRunId);
      const run =
        found?.workspace === ws && found.job_type === SCHEMA_DRAFT_REVIEW_JOB_TYPE ? found : null;
      httpAssert.present(run, { status: 404, message: 'Record validation run not found' });
      const result = (run.result ?? {}) as Record<string, unknown>;
      return {
        status: run.status,
        error: run.error,
        stale: result['stale'] === true,
        revision: typeof result['revision'] === 'number' ? result['revision'] : 0,
        entitiesChecked: (result['entitiesChecked'] as number | undefined) ?? 0,
        relationsChecked: (result['relationsChecked'] as number | undefined) ?? 0,
        problemCount: (result['problemCount'] as number | undefined) ?? 0,
        groups: (result['groups'] as never[] | undefined) ?? []
      };
    }
  });
