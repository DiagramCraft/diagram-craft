import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from './common';

export const integrationSourceStatusSchema = z.enum(['active', 'degraded', 'paused']);
export const integrationSyncRunStatusSchema = z.enum([
  'running',
  'succeeded',
  'failed',
  'cancelled'
]);
export const integrationSyncCoverageSchema = z.enum(['complete', 'partial']);
export const integrationManagedRecordTypeSchema = z.enum(['entity', 'relation', 'artifact']);
export const integrationManagedRecordStateSchema = z.enum([
  'active',
  'missing',
  'orphaned',
  'stale',
  'failing'
]);

const safeJsonRecordSchema = z.record(z.string(), z.unknown());

export const integrationSourceSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  sourceKey: z.string(),
  displayName: z.string(),
  type: z.string(),
  owner: z.string().nullable(),
  status: integrationSourceStatusSchema,
  lastSuccessAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const integrationSyncCountsSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative()
});

export const integrationSyncRunSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  sourceKey: z.string(),
  externalRunId: z.string(),
  scopeKey: z.string().nullable(),
  coverage: integrationSyncCoverageSchema,
  status: integrationSyncRunStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  counts: integrationSyncCountsSchema,
  warnings: z.array(z.string()),
  failures: z.array(z.string()),
  provenance: safeJsonRecordSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const integrationManagedRecordSchema = z.object({
  id: z.string(),
  sourceKey: z.string(),
  recordType: integrationManagedRecordTypeSchema,
  externalKey: z.string(),
  recordId: z.string().nullable(),
  state: integrationManagedRecordStateSchema,
  scopeKey: z.string().nullable(),
  failureCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  lastSeenRunId: z.string().nullable(),
  updatedAt: z.string()
});

export const integrationSyncContextSchema = z.object({
  runId: z.string().uuid(),
  scopeKey: z.string().max(500).optional()
});

const sourceParams = ws.extend({ sourceKey: z.string().min(1).max(200) });
const runParams = ws.extend({ runId: z.string().uuid() });

export const integrationSyncContract = oc.tag('Integrations').router({
  integrationSync: {
    dashboard: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/sync-control-center',
        inputStructure: 'detailed',
        summary: 'List integration sources and sync health',
        description:
          'Returns operational source, sync run, and externally managed record health without sensitive source credentials.',
        tags: ['Integrations']
      })
      .input(z.object({ params: ws }))
      .output(
        z.object({
          sources: z.array(integrationSourceSchema),
          runs: z.array(integrationSyncRunSchema),
          records: z.array(integrationManagedRecordSchema)
        })
      ),
    startRun: oc
      .route({
        method: 'POST',
        path: '/integrations/v1/{workspace}/sync-sources/{sourceKey}/runs',
        inputStructure: 'detailed',
        summary: 'Start an idempotent integration sync run',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: sourceParams,
          body: z.object({
            externalRunId: z.string().min(1).max(200),
            scopeKey: z.string().max(500).nullable().optional(),
            coverage: integrationSyncCoverageSchema,
            provenance: safeJsonRecordSchema.optional()
          })
        })
      )
      .output(integrationSyncRunSchema),
    finishRun: oc
      .route({
        method: 'PATCH',
        path: '/integrations/v1/{workspace}/sync-runs/{runId}',
        inputStructure: 'detailed',
        summary: 'Finalize an integration sync run',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: runParams,
          body: z.object({
            status: z.enum(['succeeded', 'failed', 'cancelled']),
            coverage: integrationSyncCoverageSchema.optional(),
            counts: integrationSyncCountsSchema,
            warnings: z.array(z.string().max(1000)).max(1000).optional(),
            failures: z.array(z.string().max(1000)).max(1000).optional()
          })
        })
      )
      .output(integrationSyncRunSchema),
    retryRun: oc
      .route({
        method: 'POST',
        path: '/integrations/v1/{workspace}/sync-runs/{runId}/retry',
        inputStructure: 'detailed',
        summary: 'Create a retry run for a failed integration sync',
        tags: ['Integrations']
      })
      .input(z.object({ params: runParams }))
      .output(integrationSyncRunSchema),
    relinkRecord: oc
      .route({
        method: 'POST',
        path: '/integrations/v1/{workspace}/sync-records/{id}/relink',
        inputStructure: 'detailed',
        summary: 'Explicitly relink an externally managed record',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({ id: z.string().uuid() }),
          body: z.object({ recordId: z.string().min(1), confirm: z.literal(true) })
        })
      )
      .output(integrationManagedRecordSchema),
    stopManaging: oc
      .route({
        method: 'POST',
        path: '/integrations/v1/{workspace}/sync-records/{id}/stop-managing',
        inputStructure: 'detailed',
        summary: 'Stop managing an externally managed record',
        description:
          'Removes integration tracking and external identity mappings without deleting the catalog record.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({ id: z.string().uuid() }),
          body: z.object({ confirm: z.literal(true) })
        })
      )
      .output(z.object({ success: z.literal(true) }))
  }
});

export type IntegrationSyncContext = z.infer<typeof integrationSyncContextSchema>;
export type IntegrationSource = z.infer<typeof integrationSourceSchema>;
export type IntegrationSyncRun = z.infer<typeof integrationSyncRunSchema>;
export type IntegrationManagedRecord = z.infer<typeof integrationManagedRecordSchema>;
export type IntegrationSyncCounts = z.infer<typeof integrationSyncCountsSchema>;
