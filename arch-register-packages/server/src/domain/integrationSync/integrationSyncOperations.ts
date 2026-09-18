import { randomUUID } from 'node:crypto';
import type {
  IntegrationManagedRecord,
  IntegrationSource,
  IntegrationSyncCounts,
  IntegrationSyncRun
} from '@arch-register/api-types/integrationSyncContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability, requireWorkspaceAdmin } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import type {
  IntegrationManagedRecordType,
  IntegrationSourceDbResult,
  IntegrationSyncRunDbResult
} from './db/integrationSyncDatabase';

const emptyCounts: IntegrationSyncCounts = {
  created: 0,
  updated: 0,
  unchanged: 0,
  failed: 0,
  warnings: 0
};

const redactProvenance = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(token|secret|password|credential|authorization)/i.test(key))
      .map(([key, entry]) => [
        key,
        typeof entry === 'string' ? entry.slice(0, 500) : entry
      ])
  );

const toSource = (source: IntegrationSourceDbResult): IntegrationSource => ({
  id: source.id,
  workspace: source.workspace,
  sourceKey: source.source_key,
  displayName: source.display_name,
  type: source.type,
  owner: source.owner,
  status: source.status,
  lastSuccessAt: source.last_success_at?.toISOString() ?? null,
  createdAt: source.created_at.toISOString(),
  updatedAt: source.updated_at.toISOString()
});

const toRun = (run: IntegrationSyncRunDbResult): IntegrationSyncRun => ({
  id: run.id,
  workspace: run.workspace,
  sourceKey: run.source_key,
  externalRunId: run.external_run_id,
  scopeKey: run.scope_key,
  coverage: run.coverage,
  status: run.status,
  startedAt: run.started_at.toISOString(),
  endedAt: run.ended_at?.toISOString() ?? null,
  counts: run.counts,
  warnings: run.warnings,
  failures: run.failures,
  provenance: run.provenance,
  createdAt: run.created_at.toISOString(),
  updatedAt: run.updated_at.toISOString()
});

const toRecord = (
  record: Awaited<ReturnType<DatabaseAdapter['integrationSync']['getManagedRecord']>>
): IntegrationManagedRecord => {
  if (!record) throw new Error('Managed record not found');
  return {
    id: record.id,
    sourceKey: record.source_key,
    recordType: record.record_type,
    externalKey: record.external_key,
    recordId: record.record_id,
    state: record.state,
    scopeKey: record.scope_key,
    failureCount: record.failure_count,
    lastError: record.last_error,
    lastSeenAt: record.last_seen_at?.toISOString() ?? null,
    lastSeenRunId: record.last_seen_run_id,
    updatedAt: record.updated_at.toISOString()
  };
};

const requireExternalUpdate = (authCtx: Parameters<typeof requireWorkspaceCapability>[0]) =>
  requireWorkspaceCapability(authCtx, 'ent.external_update');

export const configureIntegrationSource = async (
  db: DatabaseAdapter,
  workspace: string,
  sourceKey: string,
  body: {
    displayName: string;
    type: string;
    owner?: string | null;
    status?: 'active' | 'paused';
  },
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireWorkspaceCapability(authCtx, 'ws.settings'),
    operation: async ({ ws }) => {
      const existing = await db.integrationSync.getSource(ws, sourceKey);
      const now = new Date();
      return toSource(
        await db.integrationSync.upsertSource({
          id: existing?.id ?? randomUUID(),
          workspace: ws,
          source_key: sourceKey,
          display_name: body.displayName,
          type: body.type,
          owner: body.owner ?? existing?.owner ?? null,
          status: body.status ?? existing?.status ?? 'paused',
          created_at: existing?.created_at ?? now,
          updated_at: now
        })
      );
    }
  });

export const startIntegrationSyncRun = async (
  db: DatabaseAdapter,
  workspace: string,
  sourceKey: string,
  body: {
    externalRunId: string;
    scopeKey?: string | null;
    coverage: 'complete' | 'partial';
    provenance?: Record<string, unknown>;
  },
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireExternalUpdate(authCtx),
    operation: async ({ ws }) => {
      const source = await db.integrationSync.getSource(ws, sourceKey);
      if (!source) throw new Error(`Integration source '${sourceKey}' is not configured`);
      if (source.status !== 'active' && source.status !== 'degraded') {
        throw new Error(
          `Integration source '${sourceKey}' is not approved for syncing (status: ${source.status})`
        );
      }
      const existing = await db.integrationSync.getRunByExternalId(ws, sourceKey, body.externalRunId);
      if (existing) return toRun(existing);
      const now = new Date();
      return toRun(
        await db.integrationSync.createRun({
          id: randomUUID(),
          workspace: ws,
          source_id: source.id,
          source_key: sourceKey,
          external_run_id: body.externalRunId,
          scope_key: body.scopeKey ?? null,
          coverage: body.coverage,
          status: 'running',
          started_at: now,
          ended_at: null,
          counts: emptyCounts,
          warnings: [],
          failures: [],
          provenance: redactProvenance(body.provenance ?? {}),
          created_at: now,
          updated_at: now
        })
      );
    }
  });

export const finishIntegrationSyncRun = async (
  db: DatabaseAdapter,
  workspace: string,
  runId: string,
  body: {
    status: 'succeeded' | 'failed' | 'cancelled';
    coverage?: 'complete' | 'partial';
    counts: IntegrationSyncCounts;
    warnings?: string[];
    failures?: string[];
  },
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireExternalUpdate(authCtx),
    operation: async ({ ws }) => {
      const current = await db.integrationSync.getRun(ws, runId);
      if (!current) throw new Error(`Integration sync run '${runId}' not found`);
      const source = await db.integrationSync.getSource(ws, current.source_key);
      if (!source) throw new Error(`Integration source '${current.source_key}' is not configured`);
      const coverage = body.coverage ?? current.coverage;
      const finished = await db.integrationSync.finishRun(ws, runId, {
        status: body.status,
        coverage,
        ended_at: new Date(),
        counts: body.counts,
        warnings: body.warnings ?? [],
        failures: body.failures ?? []
      });
      if (!finished) throw new Error(`Integration sync run '${runId}' could not be finalized`);
      if (body.status === 'succeeded' && coverage === 'complete') {
        await db.integrationSync.markMissing(ws, current.source_id, runId, current.scope_key);
      }
      if (source.status !== 'paused') {
        await db.integrationSync.updateSourceHealth(
          ws,
          current.source_id,
          body.status === 'succeeded' && coverage === 'complete' && (body.counts.failed ?? 0) === 0
            ? 'active'
            : 'degraded',
          body.status === 'succeeded' ? finished.ended_at : null
        );
      }
      return toRun(finished);
    }
  });

export const recordIntegrationSyncItem = async (
  db: DatabaseAdapter,
  input: {
    workspace: string;
    sourceKey: string;
    runId: string;
    scopeKey?: string | null;
    recordType: IntegrationManagedRecordType;
    externalKey: string;
    recordId: string | null;
  }
) => {
  const run = await validateIntegrationSyncContext(db, {
    workspace: input.workspace,
    sourceKey: input.sourceKey,
    runId: input.runId,
    scopeKey: input.scopeKey
  });
  const now = new Date();
  await db.integrationSync.upsertManagedRecord({
    id: randomUUID(),
    workspace: input.workspace,
    source_id: run.source_id,
    source_key: input.sourceKey,
    record_type: input.recordType,
    external_key: input.externalKey,
    record_id: input.recordId,
    scope_key: input.scopeKey ?? run.scope_key,
    last_seen_at: now,
    last_seen_run_id: input.runId,
    updated_at: now
  });
};

export const validateIntegrationSyncContext = async (
  db: DatabaseAdapter,
  input: {
    workspace: string;
    sourceKey: string;
    runId: string;
    scopeKey?: string | null;
  }
) => {
  const source = await db.integrationSync.getSource(input.workspace, input.sourceKey);
  if (!source) throw new Error(`Integration source '${input.sourceKey}' is not configured`);
  if (source.status !== 'active' && source.status !== 'degraded') {
    throw new Error(
      `Integration source '${input.sourceKey}' is not approved for syncing (status: ${source.status})`
    );
  }
  const run = await db.integrationSync.getRun(input.workspace, input.runId);
  if (!run || run.source_key !== input.sourceKey || run.status !== 'running') {
    throw new Error('Invalid or inactive integration sync run');
  }
  if ((input.scopeKey ?? null) !== run.scope_key) {
    throw new Error('Integration sync scope does not match the run');
  }
  return run;
};

export const getIntegrationSyncDashboard = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireWorkspaceCapability(authCtx, 'ws.audit'),
    operation: async ({ ws }) => ({
      sources: (await db.integrationSync.listSources(ws)).map(toSource),
      runs: (await db.integrationSync.listRuns(ws, 100)).map(toRun),
      records: (await db.integrationSync.listManagedRecords(ws)).map(record => toRecord(record))
    })
  });

export const retryIntegrationSyncRun = async (
  db: DatabaseAdapter,
  workspace: string,
  runId: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireWorkspaceAdmin(authCtx),
    operation: async ({ ws }) => {
      const sourceRun = await db.integrationSync.getRun(ws, runId);
      if (!sourceRun) throw new Error(`Integration sync run '${runId}' not found`);
      const source = await db.integrationSync.getSource(ws, sourceRun.source_key);
      if (!source) throw new Error(`Integration source '${sourceRun.source_key}' is not configured`);
      if (source.status !== 'active' && source.status !== 'degraded') {
        throw new Error(
          `Integration source '${source.source_key}' is not approved for syncing (status: ${source.status})`
        );
      }
      const now = new Date();
      return toRun(
        await db.integrationSync.createRun({
          id: randomUUID(),
          workspace: ws,
          source_id: sourceRun.source_id,
          source_key: sourceRun.source_key,
          external_run_id: `${sourceRun.external_run_id}:retry:${randomUUID()}`,
          scope_key: sourceRun.scope_key,
          coverage: sourceRun.coverage,
          status: 'running',
          started_at: now,
          ended_at: null,
          counts: emptyCounts,
          warnings: [],
          failures: [],
          provenance: { retryOf: sourceRun.id },
          created_at: now,
          updated_at: now
        })
      );
    }
  });

export const relinkIntegrationRecord = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  recordId: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireWorkspaceAdmin(authCtx),
    operation: async ({ ws }) =>
      db.core.transaction(async tx => {
      const record = await tx.integrationSync.getManagedRecord(ws, id);
      if (!record) throw new Error(`Managed integration record '${id}' not found`);
      const targetExists =
        record.record_type === 'entity'
          ? await tx.catalog.getEntity(ws, recordId)
          : record.record_type === 'relation'
            ? await tx.relation.getRelation(ws, recordId)
            : await tx.artifact.getArtifact(ws, recordId);
      if (!targetExists) throw new Error(`Target record '${recordId}' was not found`);
      if (record.record_type === 'entity' || record.record_type === 'relation') {
        await tx.externalIdentity.upsert({
          workspace: ws,
          source: record.source_key,
          external_key: record.external_key,
          record_id: recordId
        });
      }
      const relinked = await tx.integrationSync.relinkRecord(ws, id, recordId);
      if (!relinked) throw new Error(`Managed integration record '${id}' could not be relinked`);
      const user = event.context.user;
      await tx.audit.createAuditLog({
        workspace: ws,
        timestamp: new Date(),
        user_id: user.id,
        operation: 'update',
        entity_type: 'automation_note',
        entity_id: id,
        entity_name: `Integration record ${record.external_key}`,
        entity_slug: null,
        schema_id: null,
        changes: {
          old: { record_id: record.record_id, state: record.state },
          new: { record_id: recordId, state: 'active' }
        },
        metadata: { integrationSync: true, sourceKey: record.source_key, recordType: record.record_type }
      });
      return toRecord(relinked);
      })
  });

export const stopManagingIntegrationRecord = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    before: ({ authCtx }) => requireWorkspaceAdmin(authCtx),
    operation: async ({ ws }) =>
      db.core.transaction(async tx => {
        const record = await tx.integrationSync.getManagedRecord(ws, id);
        if (!record) throw new Error(`Managed integration record '${id}' not found`);

        if (record.record_type === 'entity' || record.record_type === 'relation') {
          await tx.externalIdentity.delete(ws, record.source_key, record.external_key);
        }
        await tx.integrationSync.deleteManagedRecord(ws, id);

        const user = event.context.user;
        await tx.audit.createAuditLog({
          workspace: ws,
          timestamp: new Date(),
          user_id: user.id,
          operation: 'delete',
          entity_type: 'automation_note',
          entity_id: id,
          entity_name: `Integration record ${record.external_key}`,
          entity_slug: null,
          schema_id: null,
          changes: {
            old: {
              source_key: record.source_key,
              external_key: record.external_key,
              record_type: record.record_type,
              record_id: record.record_id,
              state: record.state
            },
            new: {}
          },
          metadata: {
            integrationSync: true,
            sourceKey: record.source_key,
            recordType: record.record_type,
            action: 'stop_managing'
          }
        });

        return { success: true as const };
      })
  });
