import { randomUUID } from 'node:crypto';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type {
  IntegrationManagedRecordDbUpsert,
  IntegrationSourceDbUpsert,
  IntegrationSyncDatabase,
  IntegrationSyncRunDbCreate
} from './integrationSyncDatabase';
import { integrationSyncMappers } from './integrationSyncDatabase';

export class PostgresIntegrationSyncDatabase extends PostgresDatabaseBase implements IntegrationSyncDatabase {
  async upsertSource(input: IntegrationSourceDbUpsert) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO integration_source
          (id, workspace, source_key, display_name, type, owner, status, created_at, updated_at)
        VALUES
          (${input.id}, ${input.workspace}, ${input.source_key}, ${input.display_name}, ${input.type}, ${input.owner}, ${input.status}, ${input.created_at}, ${input.updated_at})
        ON CONFLICT (workspace, source_key) DO UPDATE SET
          display_name = EXCLUDED.display_name, type = EXCLUDED.type, owner = EXCLUDED.owner,
          status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
        RETURNING *`;
      return integrationSyncMappers.source(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getSource(workspace: string, sourceKey: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM integration_source WHERE workspace = ${workspace} AND source_key = ${sourceKey}`;
    return row ? integrationSyncMappers.source(row) : null;
  }

  async listSources(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`SELECT * FROM integration_source WHERE workspace = ${workspace} ORDER BY display_name, source_key`;
    return mapDatabaseRows(rows, integrationSyncMappers.source);
  }

  async updateSourceHealth(workspace: string, sourceId: string, status: 'active' | 'degraded' | 'paused', lastSuccessAt: Date | null) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE integration_source SET status = ${status}, last_success_at = ${lastSuccessAt}, updated_at = NOW()
      WHERE workspace = ${workspace} AND id = ${sourceId}
      RETURNING *`;
    return row ? integrationSyncMappers.source(row) : null;
  }

  async createRun(input: IntegrationSyncRunDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO integration_sync_run
          (id, workspace, source_id, source_key, external_run_id, scope_key, coverage, status,
           started_at, ended_at, counts, warnings, failures, provenance, created_at, updated_at)
        VALUES
          (${input.id}, ${input.workspace}, ${input.source_id}, ${input.source_key}, ${input.external_run_id}, ${input.scope_key}, ${input.coverage}, ${input.status}, ${input.started_at}, ${input.ended_at}, ${this.json(input.counts)}, ${this.json(input.warnings)}, ${this.json(input.failures)}, ${this.json(input.provenance)}, ${input.created_at}, ${input.updated_at})
        RETURNING *`;
      return integrationSyncMappers.run(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getRun(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM integration_sync_run WHERE workspace = ${workspace} AND id = ${id}`;
    return row ? integrationSyncMappers.run(row) : null;
  }

  async getRunByExternalId(workspace: string, sourceKey: string, externalRunId: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM integration_sync_run WHERE workspace = ${workspace} AND source_key = ${sourceKey} AND external_run_id = ${externalRunId}`;
    return row ? integrationSyncMappers.run(row) : null;
  }

  async listRuns(workspace: string, limit: number) {
    const rows = await this.sql<DatabaseRow[]>`SELECT * FROM integration_sync_run WHERE workspace = ${workspace} ORDER BY started_at DESC, id DESC LIMIT ${limit}`;
    return mapDatabaseRows(rows, integrationSyncMappers.run);
  }

  async finishRun(workspace: string, id: string, input: Parameters<IntegrationSyncDatabase['finishRun']>[2]) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE integration_sync_run
      SET status = ${input.status}, coverage = ${input.coverage}, ended_at = ${input.ended_at},
          counts = ${this.json(input.counts)}, warnings = ${this.json(input.warnings)},
          failures = ${this.json(input.failures)}, updated_at = ${input.ended_at}
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *`;
    return row ? integrationSyncMappers.run(row) : null;
  }

  async upsertManagedRecord(input: IntegrationManagedRecordDbUpsert) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO integration_managed_record
          (id, workspace, source_id, source_key, record_type, external_key, record_id, state,
           scope_key, failure_count, last_error, last_seen_at, last_seen_run_id, updated_at)
        VALUES
          (${input.id}, ${input.workspace}, ${input.source_id}, ${input.source_key}, ${input.record_type}, ${input.external_key}, ${input.record_id}, 'active', ${input.scope_key}, 0, NULL, ${input.last_seen_at}, ${input.last_seen_run_id}, ${input.updated_at})
        ON CONFLICT (workspace, source_id, record_type, external_key) DO UPDATE SET
          record_id = EXCLUDED.record_id, state = 'active', scope_key = EXCLUDED.scope_key,
          failure_count = 0, last_error = NULL, last_seen_at = EXCLUDED.last_seen_at,
          last_seen_run_id = EXCLUDED.last_seen_run_id, updated_at = EXCLUDED.updated_at
        RETURNING *`;
      return integrationSyncMappers.record(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listManagedRecords(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`SELECT * FROM integration_managed_record WHERE workspace = ${workspace} ORDER BY updated_at DESC, id DESC`;
    return mapDatabaseRows(rows, integrationSyncMappers.record);
  }

  async getManagedRecord(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`SELECT * FROM integration_managed_record WHERE workspace = ${workspace} AND id = ${id}`;
    return row ? integrationSyncMappers.record(row) : null;
  }

  async deleteManagedRecord(workspace: string, id: string) {
    await this.sql`DELETE FROM integration_managed_record WHERE workspace = ${workspace} AND id = ${id}`;
  }

  async markMissing(workspace: string, sourceId: string, runId: string, scopeKey: string | null) {
    if (scopeKey == null) {
      await this.sql`
        UPDATE integration_managed_record SET state = 'missing', updated_at = NOW()
        WHERE workspace = ${workspace} AND source_id = ${sourceId} AND scope_key IS NULL
          AND (last_seen_run_id IS NULL OR last_seen_run_id <> ${runId}) AND state <> 'orphaned'`;
      return;
    }
    await this.sql`
      UPDATE integration_managed_record SET state = 'missing', updated_at = NOW()
      WHERE workspace = ${workspace} AND source_id = ${sourceId} AND scope_key = ${scopeKey}
        AND (last_seen_run_id IS NULL OR last_seen_run_id <> ${runId}) AND state <> 'orphaned'`;
  }

  async relinkRecord(workspace: string, id: string, recordId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE integration_managed_record SET record_id = ${recordId}, state = 'active', updated_at = NOW()
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *`;
    return row ? integrationSyncMappers.record(row) : null;
  }

  async setManagedRecordState(workspace: string, id: string, state: 'active' | 'missing' | 'orphaned' | 'stale' | 'failing', lastError: string | null = null, failureCount = 0) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE integration_managed_record
      SET state = ${state}, last_error = ${lastError}, failure_count = ${failureCount}, updated_at = NOW()
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *`;
    return row ? integrationSyncMappers.record(row) : null;
  }
}

export const newIntegrationSyncId = () => randomUUID();
