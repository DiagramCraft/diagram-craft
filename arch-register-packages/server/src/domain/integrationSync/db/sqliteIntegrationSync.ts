import { randomUUID } from 'node:crypto';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  IntegrationManagedRecordDbResult,
  IntegrationManagedRecordDbUpsert,
  IntegrationSourceDbResult,
  IntegrationSourceDbUpsert,
  IntegrationSyncDatabase,
  IntegrationSyncRunDbCreate,
  IntegrationSyncRunDbResult
} from './integrationSyncDatabase';
import { integrationSyncMappers } from './integrationSyncDatabase';

const iso = (date: Date) => date.toISOString();
const json = (value: unknown) => JSON.stringify(value);

export class SqliteIntegrationSyncDatabase
  extends SqliteDatabaseBase
  implements IntegrationSyncDatabase
{
  async upsertSource(input: IntegrationSourceDbUpsert) {
    this.run(
      `INSERT INTO integration_source
        (id, workspace, source_key, display_name, type, owner, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace, source_key) DO UPDATE SET
         display_name = excluded.display_name,
         type = excluded.type,
         owner = excluded.owner,
         status = excluded.status,
         updated_at = excluded.updated_at`,
      [
        input.id,
        input.workspace,
        input.source_key,
        input.display_name,
        input.type,
        input.owner,
        input.status,
        iso(input.created_at),
        iso(input.updated_at)
      ]
    );
    return this.get(
      'SELECT * FROM integration_source WHERE workspace = ? AND source_key = ?',
      [input.workspace, input.source_key],
      integrationSyncMappers.source
    )!;
  }

  async getSource(workspace: string, sourceKey: string) {
    return this.get(
      'SELECT * FROM integration_source WHERE workspace = ? AND source_key = ?',
      [workspace, sourceKey],
      integrationSyncMappers.source
    );
  }

  async listSources(workspace: string) {
    return this.all(
      'SELECT * FROM integration_source WHERE workspace = ? ORDER BY display_name, source_key',
      [workspace],
      integrationSyncMappers.source
    );
  }

  async updateSourceHealth(
    workspace: string,
    sourceId: string,
    status: IntegrationSourceDbResult['status'],
    lastSuccessAt: Date | null
  ) {
    this.run(
      'UPDATE integration_source SET status = ?, last_success_at = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [status, lastSuccessAt ? iso(lastSuccessAt) : null, iso(new Date()), workspace, sourceId]
    );
    return this.get(
      'SELECT * FROM integration_source WHERE workspace = ? AND id = ?',
      [workspace, sourceId],
      integrationSyncMappers.source
    );
  }

  async createRun(input: IntegrationSyncRunDbCreate) {
    this.run(
      `INSERT INTO integration_sync_run
        (id, workspace, source_id, source_key, external_run_id, scope_key, coverage, status,
         started_at, ended_at, counts, warnings, failures, provenance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.source_id,
        input.source_key,
        input.external_run_id,
        input.scope_key,
        input.coverage,
        input.status,
        iso(input.started_at),
        input.ended_at ? iso(input.ended_at) : null,
        json(input.counts),
        json(input.warnings),
        json(input.failures),
        json(input.provenance),
        iso(input.created_at),
        iso(input.updated_at)
      ]
    );
    return this.getRun(input.workspace, input.id) as Promise<IntegrationSyncRunDbResult>;
  }

  async getRun(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM integration_sync_run WHERE workspace = ? AND id = ?',
      [workspace, id],
      integrationSyncMappers.run
    );
  }

  async getRunByExternalId(workspace: string, sourceKey: string, externalRunId: string) {
    return this.get(
      'SELECT * FROM integration_sync_run WHERE workspace = ? AND source_key = ? AND external_run_id = ?',
      [workspace, sourceKey, externalRunId],
      integrationSyncMappers.run
    );
  }

  async listRuns(workspace: string, limit: number) {
    return this.all(
      'SELECT * FROM integration_sync_run WHERE workspace = ? ORDER BY started_at DESC, id DESC LIMIT ?',
      [workspace, limit],
      integrationSyncMappers.run
    );
  }

  async finishRun(
    workspace: string,
    id: string,
    input: Parameters<IntegrationSyncDatabase['finishRun']>[2]
  ) {
    this.run(
      `UPDATE integration_sync_run
       SET status = ?, coverage = ?, ended_at = ?, counts = ?, warnings = ?, failures = ?, updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.status,
        input.coverage,
        iso(input.ended_at),
        json(input.counts),
        json(input.warnings),
        json(input.failures),
        iso(input.ended_at),
        workspace,
        id
      ]
    );
    return this.getRun(workspace, id);
  }

  async upsertManagedRecord(input: IntegrationManagedRecordDbUpsert) {
    this.run(
      `INSERT INTO integration_managed_record
        (id, workspace, source_id, source_key, record_type, external_key, record_id, state,
         scope_key, failure_count, last_error, last_seen_at, last_seen_run_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, NULL, ?, ?, ?)
       ON CONFLICT(workspace, source_id, record_type, external_key) DO UPDATE SET
         record_id = excluded.record_id,
         state = 'active',
         scope_key = excluded.scope_key,
         failure_count = 0,
         last_error = NULL,
         last_seen_at = excluded.last_seen_at,
         last_seen_run_id = excluded.last_seen_run_id,
         updated_at = excluded.updated_at`,
      [
        input.id,
        input.workspace,
        input.source_id,
        input.source_key,
        input.record_type,
        input.external_key,
        input.record_id,
        input.scope_key,
        iso(input.last_seen_at),
        input.last_seen_run_id,
        iso(input.updated_at)
      ]
    );
    return this.get(
      'SELECT * FROM integration_managed_record WHERE workspace = ? AND source_id = ? AND record_type = ? AND external_key = ?',
      [input.workspace, input.source_id, input.record_type, input.external_key],
      integrationSyncMappers.record
    )!;
  }

  async listManagedRecords(workspace: string) {
    return this.all(
      'SELECT * FROM integration_managed_record WHERE workspace = ? ORDER BY updated_at DESC, id DESC',
      [workspace],
      integrationSyncMappers.record
    );
  }

  async getManagedRecord(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM integration_managed_record WHERE workspace = ? AND id = ?',
      [workspace, id],
      integrationSyncMappers.record
    );
  }

  async deleteManagedRecord(workspace: string, id: string) {
    this.run('DELETE FROM integration_managed_record WHERE workspace = ? AND id = ?', [
      workspace,
      id
    ]);
  }

  async markMissing(workspace: string, sourceId: string, runId: string, scopeKey: string | null) {
    const scope = scopeKey == null ? 'scope_key IS NULL' : 'scope_key = ?';
    const params =
      scopeKey == null ? [workspace, sourceId, runId] : [workspace, sourceId, scopeKey, runId];
    this.run(
      `UPDATE integration_managed_record
       SET state = 'missing', updated_at = ?
       WHERE workspace = ? AND source_id = ? AND ${scope}
         AND (last_seen_run_id IS NULL OR last_seen_run_id <> ?)
         AND state <> 'orphaned'`,
      [iso(new Date()), ...params]
    );
  }

  async relinkRecord(workspace: string, id: string, recordId: string) {
    this.run(
      "UPDATE integration_managed_record SET record_id = ?, state = 'active', updated_at = ? WHERE workspace = ? AND id = ?",
      [recordId, iso(new Date()), workspace, id]
    );
    return this.getManagedRecord(workspace, id);
  }

  async setManagedRecordState(
    workspace: string,
    id: string,
    state: IntegrationManagedRecordDbResult['state'],
    lastError: string | null = null,
    failureCount = 0
  ) {
    this.run(
      'UPDATE integration_managed_record SET state = ?, last_error = ?, failure_count = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [state, lastError, failureCount, iso(new Date()), workspace, id]
    );
    return this.getManagedRecord(workspace, id);
  }
}

export const newIntegrationSourceId = () => randomUUID();
