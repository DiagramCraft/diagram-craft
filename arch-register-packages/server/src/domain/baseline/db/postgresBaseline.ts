import { randomUUID } from 'node:crypto';
import type {
  BaselineDatabase,
  BaselineDbCreate,
  BaselineLinkDbCreate,
  BaselineRecordDbCreate
} from './baselineDatabase';
import { baselineMappers } from './baselineDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

export class PostgresBaselineDatabase extends PostgresDatabaseBase implements BaselineDatabase {
  async listBaselines(workspace: string, includeDeleted = false) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM architecture_baseline
      WHERE workspace = ${workspace}
        AND (${includeDeleted} = true OR deleted_at IS NULL)
      ORDER BY effective_at DESC, created_at DESC, id
    `;
    return mapDatabaseRows(rows, baselineMappers.baseline);
  }

  async getBaseline(workspace: string, id: string, includeDeleted = false) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM architecture_baseline
      WHERE workspace = ${workspace} AND id = ${id}
        AND (${includeDeleted} = true OR deleted_at IS NULL)
    `;
    return rows[0] ? baselineMappers.baseline(rows[0]) : null;
  }

  async createBaseline(input: BaselineDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO architecture_baseline (
          id, workspace, name, description, owner_team_id, created_by, effective_at,
          scope_json, query_json, include_planned_changes, include_overdue_changes,
          superseded_by_id, deleted_at, deleted_by, created_at, entity_count, relation_count
        ) VALUES (
          ${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.owner_team_id},
          ${input.created_by}, ${input.effective_at}, ${this.json(input.scope)},
          ${input.query == null ? null : this.json(input.query)}, ${input.include_planned_changes},
          ${input.include_overdue_changes}, ${input.superseded_by_id ?? null}, ${input.deleted_at ?? null},
          ${input.deleted_by ?? null}, ${input.created_at}, ${input.entity_count}, ${input.relation_count}
        )
        RETURNING *
      `;
      return baselineMappers.baseline(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async insertBaselineRecords(input: BaselineRecordDbCreate[]) {
    try {
      for (const record of input) {
        await this.sql`
          INSERT INTO architecture_baseline_record (
            id, workspace, baseline_id, record_kind, record_id, record_version_id, state_json, state_hash, position
          ) VALUES (
            ${record.id ?? randomUUID()}, ${record.workspace}, ${record.baseline_id}, ${record.record_kind},
            ${record.record_id}, ${record.record_version_id},
            ${record.state == null ? null : this.json(record.state)}, ${record.state_hash}, ${record.position}
          )
        `;
      }
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listBaselineRecords(workspace: string, baselineId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM architecture_baseline_record
      WHERE workspace = ${workspace} AND baseline_id = ${baselineId}
      ORDER BY record_kind, position, record_id
    `;
    return mapDatabaseRows(rows, baselineMappers.record);
  }

  async listBaselineLinks(workspace: string, baselineId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM architecture_baseline_link
      WHERE workspace = ${workspace} AND baseline_id = ${baselineId}
      ORDER BY created_at, id
    `;
    return mapDatabaseRows(rows, baselineMappers.link);
  }

  async createBaselineLink(input: BaselineLinkDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO architecture_baseline_link
          (id, workspace, baseline_id, target_type, target_id, created_by, created_at)
        VALUES (
          ${input.id ?? randomUUID()}, ${input.workspace}, ${input.baseline_id},
          ${input.target_type}, ${input.target_id}, ${input.created_by}, ${input.created_at}
        )
        RETURNING *
      `;
      return baselineMappers.link(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteBaselineLink(workspace: string, baselineId: string, linkId: string) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        DELETE FROM architecture_baseline_link
        WHERE workspace = ${workspace} AND baseline_id = ${baselineId} AND id = ${linkId}
        RETURNING *
      `;
      return rows[0] ? baselineMappers.link(rows[0]) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async setSupersededBy(workspace: string, id: string, replacementId: string) {
    await this.sql`
      UPDATE architecture_baseline
      SET superseded_by_id = ${replacementId}
      WHERE workspace = ${workspace} AND id = ${id} AND deleted_at IS NULL
    `;
    return this.getBaseline(workspace, id, true);
  }

  async softDelete(workspace: string, id: string, deletedBy: string, deletedAt: Date) {
    await this.sql`
      UPDATE architecture_baseline
      SET deleted_at = ${deletedAt}, deleted_by = ${deletedBy}
      WHERE workspace = ${workspace} AND id = ${id} AND deleted_at IS NULL
    `;
    return this.getBaseline(workspace, id, true);
  }
}
