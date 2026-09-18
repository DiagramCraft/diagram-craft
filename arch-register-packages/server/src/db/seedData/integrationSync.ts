import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { INTEGRATION_SYNC_IDS, now, WORKSPACE_ID } from './constants';

const counts = (values: Partial<Parameters<DatabaseAdapter['integrationSync']['finishRun']>[2]['counts']>) => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  failed: 0,
  warnings: 0,
  ...values
});

export const seedIntegrationSyncData = async (db: DatabaseAdapter): Promise<void> => {
  const backstage = await db.integrationSync.upsertSource({
    id: INTEGRATION_SYNC_IDS.sources.backstage,
    workspace: WORKSPACE_ID,
    source_key: 'backstage-github-diagram-craft',
    display_name: 'Backstage GitHub catalog',
    type: 'backstage-catalog',
    owner: '90000000-0000-0000-0000-000000000021',
    status: 'active',
    created_at: now,
    updated_at: now
  });
  const serviceNow = await db.integrationSync.upsertSource({
    id: INTEGRATION_SYNC_IDS.sources.serviceNow,
    workspace: WORKSPACE_ID,
    source_key: 'servicenow-cmdb-demo',
    display_name: 'ServiceNow CMDB (demo)',
    type: 'cmdb',
    owner: '90000000-0000-0000-0000-000000000023',
    status: 'degraded',
    created_at: now,
    updated_at: now
  });

  const previousRun = await db.integrationSync.createRun({
    id: INTEGRATION_SYNC_IDS.runs.backstagePrevious,
    workspace: WORKSPACE_ID,
    source_id: backstage.id,
    source_key: backstage.source_key,
    external_run_id: 'seed-backstage-previous',
    scope_key: 'diagram-craft',
    coverage: 'complete',
    status: 'succeeded',
    started_at: new Date('2025-12-31T23:00:00.000Z'),
    ended_at: new Date('2025-12-31T23:03:00.000Z'),
    counts: counts({ created: 1 }),
    warnings: [],
    failures: [],
    provenance: { client: 'seed' },
    created_at: new Date('2025-12-31T23:00:00.000Z'),
    updated_at: new Date('2025-12-31T23:03:00.000Z')
  });
  await db.integrationSync.upsertManagedRecord({
    id: INTEGRATION_SYNC_IDS.records.missingService,
    workspace: WORKSPACE_ID,
    source_id: backstage.id,
    source_key: backstage.source_key,
    record_type: 'entity',
    external_key: 'default/component/retired-service',
    record_id: '00000000-0000-0000-0003-000000000099',
    scope_key: 'diagram-craft',
    last_seen_at: previousRun.ended_at ?? previousRun.started_at,
    last_seen_run_id: previousRun.id,
    updated_at: previousRun.ended_at ?? previousRun.started_at
  });

  const latestRun = await db.integrationSync.createRun({
    id: INTEGRATION_SYNC_IDS.runs.backstageLatest,
    workspace: WORKSPACE_ID,
    source_id: backstage.id,
    source_key: backstage.source_key,
    external_run_id: 'seed-backstage-latest',
    scope_key: 'diagram-craft',
    coverage: 'complete',
    status: 'running',
    started_at: new Date('2026-01-01T00:00:00.000Z'),
    ended_at: null,
    counts: counts({ created: 1, updated: 2, unchanged: 3, warnings: 1 }),
    warnings: ['One catalog file used a fallback API documentation link.'],
    failures: [],
    provenance: { client: 'backstage-catalog-sync', organization: 'diagram-craft' },
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z')
  });
  const refreshSchedule = await db.jobs.createSchedule({
    id: INTEGRATION_SYNC_IDS.jobs.customerApiRefreshSchedule,
    workspace: WORKSPACE_ID,
    job_type: 'api-specification.refresh',
    system_identity: 'seed-integration-sync',
    payload: { sourceKey: 'github:diagram-craft:customer-api:spec.definition' },
    priority: 5,
    recurrence: { type: 'daily', timeUtc: '02:00' },
    enabled: true,
    next_occurrence_at: new Date('2026-01-02T02:00:00.000Z'),
    created_at: now,
    updated_at: now
  });
  const artifactId = INTEGRATION_SYNC_IDS.artifacts.customerApiSpecification;
  const artifact = await db.artifact.createArtifact({
    id: artifactId,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0004-000000000001',
    artifact_type: 'api-specification',
    source_key: 'github:diagram-craft:customer-api:spec.definition',
    kind: 'document',
    refresh_schedule_id: refreshSchedule.id,
    location: 'https://github.com/diagram-craft/catalog-info.yaml',
    media_type: 'application/vnd.oai.openapi+json;version=3.0',
    status: 'current',
    created_at: now,
    updated_at: now
  });
  const content = JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Customer API', version: '1.0.0' },
    paths: { '/customers': { get: { responses: { '200': { description: 'Customers' } } } } }
  });
  const revision = await db.artifact.createRevision({
    id: randomUUID(),
    workspace: WORKSPACE_ID,
    artifact_id: artifact.id,
    source_revision: 'seed-customer-api-v1',
    checksum: createHash('sha256').update(content).digest('hex'),
    media_type: 'application/vnd.oai.openapi+json;version=3.0',
    content,
    created_at: now
  });
  await db.artifact.updateArtifact(WORKSPACE_ID, artifact.id, {
    status: 'current',
    current_revision_id: revision.id,
    last_attempt_at: now,
    last_success_at: now,
    updated_at: now
  });
  await db.jobs.enqueueRun(refreshSchedule.id, new Date('2026-01-01T01:00:00.000Z'));
  await db.integrationSync.upsertManagedRecord({
    id: INTEGRATION_SYNC_IDS.records.customerApi,
    workspace: WORKSPACE_ID,
    source_id: backstage.id,
    source_key: backstage.source_key,
    record_type: 'entity',
    external_key: 'default/api/customer-api',
    record_id: '00000000-0000-0000-0004-000000000001',
    scope_key: 'diagram-craft',
    last_seen_at: latestRun.started_at,
    last_seen_run_id: latestRun.id,
    updated_at: latestRun.started_at
  });
  await db.integrationSync.upsertManagedRecord({
    id: INTEGRATION_SYNC_IDS.records.authApi,
    workspace: WORKSPACE_ID,
    source_id: backstage.id,
    source_key: backstage.source_key,
    record_type: 'entity',
    external_key: 'default/api/auth-api',
    record_id: '00000000-0000-0000-0004-000000000002',
    scope_key: 'diagram-craft',
    last_seen_at: latestRun.started_at,
    last_seen_run_id: latestRun.id,
    updated_at: latestRun.started_at
  });
  await db.integrationSync.upsertManagedRecord({
    id: INTEGRATION_SYNC_IDS.records.customerApiArtifact,
    workspace: WORKSPACE_ID,
    source_id: backstage.id,
    source_key: backstage.source_key,
    record_type: 'artifact',
    external_key: 'github:diagram-craft:catalog-info.yaml:customer-api:spec.definition',
    record_id: artifact.id,
    scope_key: 'diagram-craft',
    last_seen_at: latestRun.started_at,
    last_seen_run_id: latestRun.id,
    updated_at: latestRun.started_at
  });
  await db.integrationSync.finishRun(WORKSPACE_ID, latestRun.id, {
    status: 'succeeded',
    coverage: 'complete',
    ended_at: new Date('2026-01-01T00:04:00.000Z'),
    counts: latestRun.counts,
    warnings: latestRun.warnings,
    failures: latestRun.failures
  });
  await db.integrationSync.markMissing(WORKSPACE_ID, backstage.id, latestRun.id, 'diagram-craft');
  await db.integrationSync.updateSourceHealth(WORKSPACE_ID, backstage.id, 'active', new Date('2026-01-01T00:04:00.000Z'));

  const partialRun = await db.integrationSync.createRun({
    id: INTEGRATION_SYNC_IDS.runs.serviceNowPartial,
    workspace: WORKSPACE_ID,
    source_id: serviceNow.id,
    source_key: serviceNow.source_key,
    external_run_id: 'seed-servicenow-partial',
    scope_key: 'production-cmdb',
    coverage: 'partial',
    status: 'succeeded',
    started_at: new Date('2025-12-31T22:00:00.000Z'),
    ended_at: new Date('2025-12-31T22:01:30.000Z'),
    counts: counts({ updated: 1, failed: 2, warnings: 2 }),
    warnings: ['CMDB pagination ended before the final page.'],
    failures: ['CMDB-204: upstream timeout', 'CMDB-219: restricted record'],
    provenance: { client: 'seed', page: 4 },
    created_at: new Date('2025-12-31T22:00:00.000Z'),
    updated_at: new Date('2025-12-31T22:01:30.000Z')
  });
  await db.integrationSync.upsertManagedRecord({
    id: INTEGRATION_SYNC_IDS.records.staleApi,
    workspace: WORKSPACE_ID,
    source_id: serviceNow.id,
    source_key: serviceNow.source_key,
    record_type: 'artifact',
    external_key: 'servicenow:cmdb:customer-portal-api',
    record_id: null,
    scope_key: 'production-cmdb',
    last_seen_at: partialRun.ended_at ?? partialRun.started_at,
    last_seen_run_id: partialRun.id,
    updated_at: partialRun.ended_at ?? partialRun.started_at
  });
  await db.integrationSync.setManagedRecordState(WORKSPACE_ID, INTEGRATION_SYNC_IDS.records.staleApi, 'stale', 'Last refresh failed; previous revision retained.', 2);
  await db.integrationSync.upsertManagedRecord({
    id: INTEGRATION_SYNC_IDS.records.orphanedRelation,
    workspace: WORKSPACE_ID,
    source_id: serviceNow.id,
    source_key: serviceNow.source_key,
    record_type: 'relation',
    external_key: 'servicenow:cmdb:legacy-payment-dependency',
    record_id: null,
    scope_key: 'production-cmdb',
    last_seen_at: partialRun.ended_at ?? partialRun.started_at,
    last_seen_run_id: partialRun.id,
    updated_at: partialRun.ended_at ?? partialRun.started_at
  });
  await db.integrationSync.setManagedRecordState(WORKSPACE_ID, INTEGRATION_SYNC_IDS.records.orphanedRelation, 'orphaned');
};
