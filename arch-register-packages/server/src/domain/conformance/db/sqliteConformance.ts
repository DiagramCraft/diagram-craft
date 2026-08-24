import { randomUUID } from 'node:crypto';
import type { DatabaseRow } from '../../../db/rowMappers';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  ConformanceCheckDbCreate,
  ConformanceCheckDbUpdate,
  ConformanceDatabase,
  ConformanceEntityEvaluationUpsert,
  ConformanceExemptionDbResult,
  ConformanceRunDbCreate,
  ConformanceRunDbUpdate,
  ConformanceViolationDbResult,
  ConformanceViolationEventDbCreate,
  ConformanceViolationCounts,
  ConformanceViolationListOptions,
  ConformanceViolationUpsert
} from './conformanceDatabase';
import { conformanceMappers } from './conformanceDatabase';

// A violation's effective status is derived at read time: an active, unexpired exemption
// overrides the persisted `v.status` to 'exempt' (exempting a violation never rewrites that
// column). Filtering must use this same expression, not the raw column, or an exempted
// violation still matches a `status = 'active'` filter.
const EFFECTIVE_STATUS_SQL = `
    CASE
      WHEN x.id IS NOT NULL
       AND x.revoked_at IS NULL
       AND v.status != 'resolved'
       AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
      THEN 'exempt'
      ELSE v.status
    END
`;

const VIOLATION_SELECT = `
  SELECT v.*,
    c.name AS check_name,
    json_extract(c.definition, '$.type') AS source_type,
    e.name AS entity_name,
    e.owner AS owner_team_id,
    x.id AS exemption_id,
    x.reason AS exemption_reason,
    x.expires_at AS exemption_expires_at,
    x.created_by AS exemption_created_by,
    x.created_at AS exemption_created_at,
    x.revoked_at AS exemption_revoked_at,
    ${EFFECTIVE_STATUS_SQL} AS status
  FROM conformance_violation v
  JOIN conformance_check c ON c.id = v.check_id
  LEFT JOIN catalog_record e ON e.id = v.entity_id AND e.kind = 'entity'
  LEFT JOIN conformance_exemption x ON x.violation_id = v.id AND x.revoked_at IS NULL
`;

export class SqliteConformanceDatabase extends SqliteDatabaseBase implements ConformanceDatabase {
  async listChecks(workspace: string) {
    return this.all(
      'SELECT * FROM conformance_check WHERE workspace = ? ORDER BY name, id',
      [workspace],
      conformanceMappers.check
    );
  }

  async getCheck(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM conformance_check WHERE workspace = ? AND id = ?',
      [workspace, id],
      conformanceMappers.check
    );
  }

  async createCheck(input: ConformanceCheckDbCreate) {
    this.run(
      `INSERT INTO conformance_check
       (id, workspace, name, description, severity, enabled, definition, revision, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        input.severity,
        input.enabled ? 1 : 0,
        JSON.stringify(input.definition),
        input.revision,
        input.created_by,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    this.run(
      `INSERT INTO conformance_check_revision
       (id, check_id, revision, definition, severity, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.id,
        input.revision,
        JSON.stringify(input.definition),
        input.severity,
        input.created_by,
        input.created_at.toISOString()
      ]
    );
    return (await this.getCheck(input.workspace, input.id))!;
  }

  async updateCheck(workspace: string, id: string, input: ConformanceCheckDbUpdate) {
    const existing = await this.getCheck(workspace, id);
    if (!existing) return null;
    this.run(
      `UPDATE conformance_check
       SET name = ?, description = ?, severity = ?, enabled = ?, definition = ?, revision = ?, updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        input.severity ?? existing.severity,
        (input.enabled ?? existing.enabled) ? 1 : 0,
        JSON.stringify(input.definition ?? existing.definition),
        input.revision,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    this.run(
      `INSERT INTO conformance_check_revision
       (id, check_id, revision, definition, severity, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        id,
        input.revision,
        JSON.stringify(input.definition ?? existing.definition),
        input.severity ?? existing.severity,
        existing.created_by,
        input.updated_at.toISOString()
      ]
    );
    return await this.getCheck(workspace, id);
  }

  async deleteCheck(workspace: string, id: string) {
    const existing = await this.getCheck(workspace, id);
    if (!existing) return null;
    this.run('DELETE FROM conformance_check WHERE workspace = ? AND id = ?', [workspace, id]);
    return existing;
  }

  async createRun(input: ConformanceRunDbCreate) {
    this.run(
      `INSERT INTO conformance_evaluation_run
       (id, workspace, check_id, job_run_id, status, started_at, completed_at, checked_count, violation_count, error, configuration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.check_id,
        input.job_run_id,
        input.status,
        input.started_at.toISOString(),
        input.completed_at?.toISOString() ?? null,
        input.checked_count,
        input.violation_count,
        input.error,
        JSON.stringify(input.configuration)
      ]
    );
    return (await this.getRun(input.workspace, input.id))!;
  }

  async getRun(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM conformance_evaluation_run WHERE workspace = ? AND id = ?',
      [workspace, id],
      conformanceMappers.run
    );
  }

  async listRuns(workspace: string, limit: number) {
    return this.all(
      'SELECT * FROM conformance_evaluation_run WHERE workspace = ? ORDER BY started_at DESC LIMIT ?',
      [workspace, limit],
      conformanceMappers.run
    );
  }

  async updateRun(workspace: string, id: string, input: ConformanceRunDbUpdate) {
    this.run(
      `UPDATE conformance_evaluation_run
       SET status = ?, completed_at = ?, checked_count = ?, violation_count = ?, error = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.status,
        input.completed_at?.toISOString() ?? null,
        input.checked_count,
        input.violation_count,
        input.error,
        workspace,
        id
      ]
    );
    return await this.getRun(workspace, id);
  }

  async recordEntityEvaluations(input: ConformanceEntityEvaluationUpsert[]) {
    // Batched into one multi-row INSERT per chunk instead of one statement per evaluation: with
    // 6 bound params/row, ROWS_PER_STATEMENT keeps every chunk safely under SQLite's default
    // host-parameter limit (SQLITE_MAX_VARIABLE_NUMBER, 999 on older builds).
    const ROWS_PER_STATEMENT = 150;
    for (let offset = 0; offset < input.length; offset += ROWS_PER_STATEMENT) {
      const chunk = input.slice(offset, offset + ROWS_PER_STATEMENT);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const params = chunk.flatMap(evaluation => [
        evaluation.workspace,
        evaluation.check_id,
        evaluation.entity_id,
        evaluation.check_revision,
        evaluation.run_id,
        evaluation.evaluated_at.toISOString()
      ]);
      this.run(
        `INSERT INTO conformance_entity_evaluation
           (workspace, check_id, entity_id, check_revision, run_id, evaluated_at)
         VALUES ${placeholders}
         ON CONFLICT (workspace, check_id, entity_id) DO UPDATE SET
           check_revision = excluded.check_revision,
           run_id = excluded.run_id,
           evaluated_at = excluded.evaluated_at
         WHERE excluded.evaluated_at >= conformance_entity_evaluation.evaluated_at`,
        params
      );
    }
  }

  private mapViolation(row: DatabaseRow): ConformanceViolationDbResult {
    return conformanceMappers.violation(row);
  }

  async getViolation(workspace: string, id: string) {
    return this.get(
      `${VIOLATION_SELECT} WHERE v.workspace = ? AND v.id = ?`,
      [workspace, id],
      row => this.mapViolation(row)
    );
  }

  async listViolations(workspace: string, options: ConformanceViolationListOptions) {
    const where = ['v.workspace = ?'];
    const params: unknown[] = [workspace];
    if (options.check_id) {
      where.push('v.check_id = ?');
      params.push(options.check_id);
    }
    if (options.entity_id) {
      where.push('v.entity_id = ?');
      params.push(options.entity_id);
    }
    if (options.schema_id) {
      where.push('e.schema_id = ?');
      params.push(options.schema_id);
    }
    if (options.owner_id) {
      where.push('e.owner = ?');
      params.push(options.owner_id);
    }
    if (options.status) {
      where.push(`(${EFFECTIVE_STATUS_SQL}) = ?`);
      params.push(options.status);
    }
    if (options.severity) {
      where.push('v.severity = ?');
      params.push(options.severity);
    }
    const whereSql = where.join(' AND ');
    const count = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM conformance_violation v
       JOIN catalog_record e ON e.id = v.entity_id AND e.kind = 'entity'
       LEFT JOIN conformance_exemption x ON x.violation_id = v.id AND x.revoked_at IS NULL
       WHERE ${whereSql}`,
      params
    );
    const rows = this.all(
      `${VIOLATION_SELECT} WHERE ${whereSql} ORDER BY v.last_seen_at DESC, v.id DESC LIMIT ? OFFSET ?`,
      [...params, options.limit, options.offset],
      row => this.mapViolation(row)
    );
    return { items: rows, total: Number(count?.count ?? 0) };
  }

  async countViolations(workspace: string): Promise<ConformanceViolationCounts> {
    const row = this.get<{
      active: number;
      acknowledged: number;
      warnings: number;
      errors: number;
      exempt: number;
      resolved_recently: number;
    }>(
      `SELECT
         SUM(CASE WHEN v.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM conformance_exemption x
             WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
               AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
           ) THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN v.status = 'acknowledged'
           AND NOT EXISTS (
             SELECT 1 FROM conformance_exemption x
             WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
               AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
           ) THEN 1 ELSE 0 END) AS acknowledged,
         SUM(CASE WHEN v.status = 'active' AND v.severity = 'warning'
           AND NOT EXISTS (
             SELECT 1 FROM conformance_exemption x
             WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
               AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
           ) THEN 1 ELSE 0 END) AS warnings,
         SUM(CASE WHEN v.status = 'active' AND v.severity = 'error'
           AND NOT EXISTS (
             SELECT 1 FROM conformance_exemption x
             WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
               AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
           ) THEN 1 ELSE 0 END) AS errors,
         SUM(CASE WHEN EXISTS (
           SELECT 1 FROM conformance_exemption x
           WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
             AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
         ) THEN 1 ELSE 0 END) AS exempt,
         SUM(CASE WHEN v.status = 'resolved' AND v.resolved_at >= datetime('now', '-30 days')
           THEN 1 ELSE 0 END) AS resolved_recently
       FROM conformance_violation v
       WHERE v.workspace = ?`,
      [workspace]
    );
    return {
      active: Number(row?.active ?? 0),
      acknowledged: Number(row?.acknowledged ?? 0),
      warnings: Number(row?.warnings ?? 0),
      errors: Number(row?.errors ?? 0),
      exempt: Number(row?.exempt ?? 0),
      resolvedRecently: Number(row?.resolved_recently ?? 0)
    };
  }

  async upsertViolation(input: ConformanceViolationUpsert) {
    this.run(
      `INSERT INTO conformance_violation
       (id, workspace, check_id, entity_id, schema_id, severity, message, evidence, status, first_seen_at, last_seen_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
       ON CONFLICT (workspace, check_id, entity_id) DO UPDATE SET
         schema_id = excluded.schema_id,
         severity = excluded.severity,
         message = excluded.message,
         evidence = excluded.evidence,
         status = 'active',
         last_seen_at = excluded.last_seen_at,
         resolved_at = NULL`,
      [
        input.id,
        input.workspace,
        input.check_id,
        input.entity_id,
        input.schema_id,
        input.severity,
        input.message,
        JSON.stringify(input.evidence),
        input.seen_at.toISOString(),
        input.seen_at.toISOString()
      ]
    );
    const violation =
      (await this.getViolation(input.workspace, input.id)) ??
      (await this.get(
        `${VIOLATION_SELECT} WHERE v.workspace = ? AND v.check_id = ? AND v.entity_id = ?`,
        [input.workspace, input.check_id, input.entity_id],
        row => this.mapViolation(row)
      ))!;
    await this.createViolationEvent({
      id: randomUUID(),
      workspace: input.workspace,
      violation_id: violation.id,
      run_id: input.run_id,
      event_type: 'observed',
      details: { severity: input.severity },
      occurred_at: input.seen_at
    });
    return violation;
  }

  async setViolationStatus(
    workspace: string,
    id: string,
    status: 'active' | 'acknowledged' | 'resolved',
    changedAt: Date,
    details: Record<string, unknown>
  ) {
    const existing = await this.getViolation(workspace, id);
    if (!existing) return null;
    this.run(
      `UPDATE conformance_violation
       SET status = ?, resolved_at = ?
       WHERE workspace = ? AND id = ?`,
      [status, status === 'resolved' ? changedAt.toISOString() : null, workspace, id]
    );
    await this.createViolationEvent({
      id: randomUUID(),
      workspace,
      violation_id: id,
      run_id: null,
      event_type:
        status === 'acknowledged'
          ? 'acknowledged'
          : status === 'resolved'
            ? 'resolved'
            : 'observed',
      details,
      occurred_at: changedAt
    });
    return this.getViolation(workspace, id);
  }

  async createViolationEvent(input: ConformanceViolationEventDbCreate) {
    this.run(
      `INSERT INTO conformance_violation_event
       (id, workspace, violation_id, run_id, event_type, details, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.violation_id,
        input.run_id,
        input.event_type,
        JSON.stringify(input.details),
        input.occurred_at.toISOString()
      ]
    );
  }

  async resolveUnseenViolations(
    workspace: string,
    checkId: string,
    seenEntityIds: string[],
    resolvedAt: Date,
    runId: string | null
  ) {
    const clauses = ['workspace = ?', 'check_id = ?', "status IN ('active', 'acknowledged')"];
    const selectParams: unknown[] = [workspace, checkId];
    if (seenEntityIds.length > 0) {
      const placeholders = seenEntityIds.map(() => '?').join(', ');
      clauses.push(`entity_id NOT IN (${placeholders})`);
      selectParams.push(...seenEntityIds);
    }
    const rows = this.all<{ id: string }>(
      `SELECT id FROM conformance_violation WHERE ${clauses.join(' AND ')}`,
      selectParams
    );
    if (rows.length === 0) return [];
    this.run(
      `UPDATE conformance_violation
       SET status = 'resolved', resolved_at = ?
       WHERE ${clauses.join(' AND ')}`,
      [resolvedAt.toISOString(), ...selectParams]
    );
    for (const row of rows) {
      await this.createViolationEvent({
        id: randomUUID(),
        workspace,
        violation_id: row.id,
        run_id: runId,
        event_type: 'resolved',
        details: { reason: 'Evaluation no longer matched the entity' },
        occurred_at: resolvedAt
      });
    }
    return rows.map(row => row.id);
  }

  async createExemption(input: ConformanceExemptionDbResult) {
    this.run(
      `INSERT INTO conformance_exemption
       (id, workspace, violation_id, reason, expires_at, created_by, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.violation_id,
        input.reason,
        input.expires_at?.toISOString() ?? null,
        input.created_by,
        input.created_at.toISOString(),
        input.revoked_at?.toISOString() ?? null
      ]
    );
    this.run("UPDATE conformance_violation SET status = 'active' WHERE workspace = ? AND id = ?", [
      input.workspace,
      input.violation_id
    ]);
    await this.createViolationEvent({
      id: randomUUID(),
      workspace: input.workspace,
      violation_id: input.violation_id,
      run_id: null,
      event_type: 'exempted',
      details: { reason: input.reason, expiresAt: input.expires_at?.toISOString() ?? null },
      occurred_at: input.created_at
    });
    const row = await this.get(
      'SELECT * FROM conformance_exemption WHERE workspace = ? AND id = ?',
      [input.workspace, input.id],
      conformanceMappers.exemption
    );
    return row!;
  }
}
