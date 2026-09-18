import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type IntegrationSourceStatus = 'active' | 'degraded' | 'paused';
export type IntegrationSyncRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type IntegrationSyncCoverage = 'complete' | 'partial';
export type IntegrationManagedRecordType = 'entity' | 'relation' | 'artifact';
export type IntegrationManagedRecordState = 'active' | 'missing' | 'orphaned' | 'stale' | 'failing';

export type IntegrationSourceDbResult = {
  id: string;
  workspace: string;
  source_key: string;
  display_name: string;
  type: string;
  owner: string | null;
  status: IntegrationSourceStatus;
  last_success_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type IntegrationSyncCounts = {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  warnings: number;
};

export type IntegrationSyncRunDbResult = {
  id: string;
  workspace: string;
  source_id: string;
  source_key: string;
  external_run_id: string;
  scope_key: string | null;
  coverage: IntegrationSyncCoverage;
  status: IntegrationSyncRunStatus;
  started_at: Date;
  ended_at: Date | null;
  counts: IntegrationSyncCounts;
  warnings: string[];
  failures: string[];
  provenance: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type IntegrationManagedRecordDbResult = {
  id: string;
  workspace: string;
  source_id: string;
  source_key: string;
  record_type: IntegrationManagedRecordType;
  external_key: string;
  record_id: string | null;
  state: IntegrationManagedRecordState;
  scope_key: string | null;
  failure_count: number;
  last_error: string | null;
  last_seen_at: Date | null;
  last_seen_run_id: string | null;
  updated_at: Date;
};

export type IntegrationSourceDbUpsert = {
  id: string;
  workspace: string;
  source_key: string;
  display_name: string;
  type: string;
  owner: string | null;
  status: IntegrationSourceStatus;
  created_at: Date;
  updated_at: Date;
};

export type IntegrationSyncRunDbCreate = {
  id: string;
  workspace: string;
  source_id: string;
  source_key: string;
  external_run_id: string;
  scope_key: string | null;
  coverage: IntegrationSyncCoverage;
  status: IntegrationSyncRunStatus;
  started_at: Date;
  ended_at: Date | null;
  counts: IntegrationSyncCounts;
  warnings: string[];
  failures: string[];
  provenance: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type IntegrationManagedRecordDbUpsert = {
  id: string;
  workspace: string;
  source_id: string;
  source_key: string;
  record_type: IntegrationManagedRecordType;
  external_key: string;
  record_id: string | null;
  scope_key: string | null;
  last_seen_at: Date;
  last_seen_run_id: string;
  updated_at: Date;
};

export const integrationSyncMappers = {
  source: (row: DatabaseRow): IntegrationSourceDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    source_key: String(row['source_key']),
    display_name: String(row['display_name']),
    type: String(row['type']),
    owner: row['owner'] == null ? null : String(row['owner']),
    status: String(row['status']) as IntegrationSourceStatus,
    last_success_at: row['last_success_at'] == null ? null : databaseDate(row['last_success_at']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  run: (row: DatabaseRow): IntegrationSyncRunDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    source_id: String(row['source_id']),
    source_key: String(row['source_key']),
    external_run_id: String(row['external_run_id']),
    scope_key: row['scope_key'] == null ? null : String(row['scope_key']),
    coverage: String(row['coverage']) as IntegrationSyncCoverage,
    status: String(row['status']) as IntegrationSyncRunStatus,
    started_at: databaseDate(row['started_at']),
    ended_at: row['ended_at'] == null ? null : databaseDate(row['ended_at']),
    counts: parseDatabaseJson<IntegrationSyncCounts>(
      row['counts'],
      { created: 0, updated: 0, unchanged: 0, failed: 0, warnings: 0 },
      'integration_sync_run.counts'
    ),
    warnings: parseDatabaseJson<string[]>(row['warnings'], [], 'integration_sync_run.warnings'),
    failures: parseDatabaseJson<string[]>(row['failures'], [], 'integration_sync_run.failures'),
    provenance: parseDatabaseJson<Record<string, unknown>>(
      row['provenance'],
      {},
      'integration_sync_run.provenance'
    ),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  record: (row: DatabaseRow): IntegrationManagedRecordDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    source_id: String(row['source_id']),
    source_key: String(row['source_key']),
    record_type: String(row['record_type']) as IntegrationManagedRecordType,
    external_key: String(row['external_key']),
    record_id: row['record_id'] == null ? null : String(row['record_id']),
    state: String(row['state']) as IntegrationManagedRecordState,
    scope_key: row['scope_key'] == null ? null : String(row['scope_key']),
    failure_count: Number(row['failure_count'] ?? 0),
    last_error: row['last_error'] == null ? null : String(row['last_error']),
    last_seen_at: row['last_seen_at'] == null ? null : databaseDate(row['last_seen_at']),
    last_seen_run_id: row['last_seen_run_id'] == null ? null : String(row['last_seen_run_id']),
    updated_at: databaseDate(row['updated_at'])
  })
};

export type IntegrationSyncDatabase = {
  upsertSource(input: IntegrationSourceDbUpsert): Promise<IntegrationSourceDbResult>;
  getSource(workspace: string, sourceKey: string): Promise<IntegrationSourceDbResult | null>;
  listSources(workspace: string): Promise<IntegrationSourceDbResult[]>;
  updateSourceHealth(
    workspace: string,
    sourceId: string,
    status: IntegrationSourceStatus,
    lastSuccessAt: Date | null
  ): Promise<IntegrationSourceDbResult | null>;
  createRun(input: IntegrationSyncRunDbCreate): Promise<IntegrationSyncRunDbResult>;
  getRun(workspace: string, id: string): Promise<IntegrationSyncRunDbResult | null>;
  getRunByExternalId(
    workspace: string,
    sourceKey: string,
    externalRunId: string
  ): Promise<IntegrationSyncRunDbResult | null>;
  listRuns(workspace: string, limit: number): Promise<IntegrationSyncRunDbResult[]>;
  finishRun(
    workspace: string,
    id: string,
    input: {
      status: Exclude<IntegrationSyncRunStatus, 'running'>;
      coverage: IntegrationSyncCoverage;
      ended_at: Date;
      counts: IntegrationSyncCounts;
      warnings: string[];
      failures: string[];
    }
  ): Promise<IntegrationSyncRunDbResult | null>;
  upsertManagedRecord(
    input: IntegrationManagedRecordDbUpsert
  ): Promise<IntegrationManagedRecordDbResult>;
  listManagedRecords(workspace: string): Promise<IntegrationManagedRecordDbResult[]>;
  getManagedRecord(workspace: string, id: string): Promise<IntegrationManagedRecordDbResult | null>;
  deleteManagedRecord(workspace: string, id: string): Promise<void>;
  markMissing(
    workspace: string,
    sourceId: string,
    runId: string,
    scopeKey: string | null
  ): Promise<void>;
  relinkRecord(
    workspace: string,
    id: string,
    recordId: string
  ): Promise<IntegrationManagedRecordDbResult | null>;
  setManagedRecordState(
    workspace: string,
    id: string,
    state: IntegrationManagedRecordState,
    lastError?: string | null,
    failureCount?: number
  ): Promise<IntegrationManagedRecordDbResult | null>;
};
