import { randomUUID } from 'node:crypto';
import type {
  BaselineDatabase,
  BaselineDbCreate,
  BaselineLinkDbCreate,
  BaselineRecordDbCreate
} from './baselineDatabase';
import { baselineMappers } from './baselineDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteBaselineDatabase extends SqliteDatabaseBase implements BaselineDatabase {
  async listBaselines(workspace: string, includeDeleted = false) {
    return this.all(
      `SELECT * FROM architecture_baseline
       WHERE workspace = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
       ORDER BY effective_at DESC, created_at DESC, id`,
      [workspace],
      baselineMappers.baseline
    );
  }

  async getBaseline(workspace: string, id: string, includeDeleted = false) {
    return this.get(
      `SELECT * FROM architecture_baseline
       WHERE workspace = ? AND id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
      [workspace, id],
      baselineMappers.baseline
    );
  }

  async createBaseline(input: BaselineDbCreate) {
    this.run(
      `INSERT INTO architecture_baseline (
        id, workspace, name, description, owner_team_id, created_by, effective_at,
        scope_json, query_json, include_planned_changes, include_overdue_changes,
        superseded_by_id, deleted_at, deleted_by, created_at, entity_count, relation_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        input.owner_team_id,
        input.created_by,
        input.effective_at.toISOString(),
        JSON.stringify(input.scope),
        input.query == null ? null : JSON.stringify(input.query),
        input.include_planned_changes ? 1 : 0,
        input.include_overdue_changes ? 1 : 0,
        input.superseded_by_id ?? null,
        input.deleted_at?.toISOString() ?? null,
        input.deleted_by ?? null,
        input.created_at.toISOString(),
        input.entity_count,
        input.relation_count
      ]
    );
    return (await this.getBaseline(input.workspace, input.id, true))!;
  }

  async insertBaselineRecords(input: BaselineRecordDbCreate[]) {
    const statement = this.db.prepare(
      `INSERT INTO architecture_baseline_record (
        id, workspace, baseline_id, record_kind, record_id, state_json, schema_json, state_hash, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const record of input) {
      statement.run(
        record.id ?? randomUUID(),
        record.workspace,
        record.baseline_id,
        record.record_kind,
        record.record_id,
        JSON.stringify(record.state),
        record.schema == null ? null : JSON.stringify(record.schema),
        record.state_hash,
        record.position
      );
    }
  }

  async listBaselineRecords(workspace: string, baselineId: string) {
    return this.all(
      `SELECT * FROM architecture_baseline_record
       WHERE workspace = ? AND baseline_id = ?
       ORDER BY record_kind, position, record_id`,
      [workspace, baselineId],
      baselineMappers.record
    );
  }

  async listBaselineLinks(workspace: string, baselineId: string) {
    return this.all(
      `SELECT * FROM architecture_baseline_link
       WHERE workspace = ? AND baseline_id = ?
       ORDER BY created_at, id`,
      [workspace, baselineId],
      baselineMappers.link
    );
  }

  async createBaselineLink(input: BaselineLinkDbCreate) {
    const id = input.id ?? randomUUID();
    this.run(
      `INSERT INTO architecture_baseline_link
       (id, workspace, baseline_id, target_type, target_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.workspace,
        input.baseline_id,
        input.target_type,
        input.target_id,
        input.created_by,
        input.created_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM architecture_baseline_link WHERE workspace = ? AND id = ?',
      [input.workspace, id],
      baselineMappers.link
    ))!;
  }

  async deleteBaselineLink(workspace: string, baselineId: string, linkId: string) {
    const existing = this.get(
      `SELECT * FROM architecture_baseline_link
       WHERE workspace = ? AND baseline_id = ? AND id = ?`,
      [workspace, baselineId, linkId],
      baselineMappers.link
    );
    if (!existing) return null;
    this.run(
      'DELETE FROM architecture_baseline_link WHERE workspace = ? AND baseline_id = ? AND id = ?',
      [workspace, baselineId, linkId]
    );
    return existing;
  }

  async setSupersededBy(workspace: string, id: string, replacementId: string) {
    this.run(
      `UPDATE architecture_baseline
       SET superseded_by_id = ?
       WHERE workspace = ? AND id = ? AND deleted_at IS NULL`,
      [replacementId, workspace, id]
    );
    return this.getBaseline(workspace, id, true);
  }

  async softDelete(workspace: string, id: string, deletedBy: string, deletedAt: Date) {
    this.run(
      `UPDATE architecture_baseline
       SET deleted_at = ?, deleted_by = ?
       WHERE workspace = ? AND id = ? AND deleted_at IS NULL`,
      [deletedAt.toISOString(), deletedBy, workspace, id]
    );
    return this.getBaseline(workspace, id, true);
  }
}
