import { randomUUID } from 'node:crypto';
import type { DatabaseRow } from '../../../db/rowMappers';
import { mapDatabaseRows } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type {
  ConformanceCheckDbCreate,
  ConformanceCheckDbUpdate,
  ConformanceDatabase,
  ConformanceExemptionDbResult,
  ConformanceRunDbCreate,
  ConformanceRunDbUpdate,
  ConformanceViolationListOptions,
  ConformanceViolationCounts,
  ConformanceViolationEventDbCreate,
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
       AND (x.expires_at IS NULL OR x.expires_at > NOW())
      THEN 'exempt'
      ELSE v.status
    END
`;

const VIOLATION_SELECT = `
  SELECT v.*,
    c.name AS check_name,
    c.definition->>'type' AS source_type,
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

export class PostgresConformanceDatabase
  extends PostgresDatabaseBase
  implements ConformanceDatabase
{
  async listChecks(workspace: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM conformance_check WHERE workspace = ${workspace} ORDER BY name, id
    `;
    return mapDatabaseRows(rows, conformanceMappers.check);
  }

  async getCheck(workspace: string, id: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM conformance_check WHERE workspace = ${workspace} AND id = ${id}
    `;
    return rows[0] ? conformanceMappers.check(rows[0]) : null;
  }

  async createCheck(input: ConformanceCheckDbCreate) {
    try {
      await this.sql`
        INSERT INTO conformance_check
          (id, workspace, name, description, severity, enabled, definition, revision, created_by, created_at, updated_at)
        VALUES
          (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.severity},
           ${input.enabled}, ${this.json(input.definition)}, ${input.revision}, ${input.created_by},
           ${input.created_at}, ${input.updated_at})
      `;
      await this.sql`
        INSERT INTO conformance_check_revision
          (id, check_id, revision, definition, severity, created_by, created_at)
        VALUES
          (${randomUUID()}, ${input.id}, ${input.revision},
           ${this.json(input.definition)}, ${input.severity}, ${input.created_by}, ${input.created_at})
      `;
      return (await this.getCheck(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateCheck(workspace: string, id: string, input: ConformanceCheckDbUpdate) {
    const existing = await this.getCheck(workspace, id);
    if (!existing) return null;
    try {
      await this.sql`
        UPDATE conformance_check
        SET name = ${input.name ?? existing.name},
            description = ${input.description === undefined ? existing.description : input.description},
            severity = ${input.severity ?? existing.severity},
            enabled = ${input.enabled ?? existing.enabled},
            definition = ${this.json(input.definition ?? existing.definition)},
            revision = ${input.revision},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      await this.sql`
        INSERT INTO conformance_check_revision
          (id, check_id, revision, definition, severity, created_by, created_at)
        VALUES
          (${randomUUID()}, ${id}, ${input.revision},
           ${this.json(input.definition ?? existing.definition)},
           ${input.severity ?? existing.severity}, ${existing.created_by}, ${input.updated_at})
      `;
      return await this.getCheck(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteCheck(workspace: string, id: string) {
    const existing = await this.getCheck(workspace, id);
    if (!existing) return null;
    try {
      await this.sql`DELETE FROM conformance_check WHERE workspace = ${workspace} AND id = ${id}`;
      return existing;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createRun(input: ConformanceRunDbCreate) {
    await this.sql`
      INSERT INTO conformance_evaluation_run
        (id, workspace, check_id, job_run_id, status, started_at, completed_at, checked_count, violation_count, error, configuration)
      VALUES
        (${input.id}, ${input.workspace}, ${input.check_id}, ${input.job_run_id}, ${input.status},
         ${input.started_at}, ${input.completed_at}, ${input.checked_count}, ${input.violation_count},
         ${input.error}, ${this.json(input.configuration)})
    `;
    return (await this.getRun(input.workspace, input.id))!;
  }

  async getRun(workspace: string, id: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM conformance_evaluation_run WHERE workspace = ${workspace} AND id = ${id}
    `;
    return rows[0] ? conformanceMappers.run(rows[0]) : null;
  }

  async listRuns(workspace: string, limit: number) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM conformance_evaluation_run
      WHERE workspace = ${workspace}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `;
    return mapDatabaseRows(rows, conformanceMappers.run);
  }

  async updateRun(workspace: string, id: string, input: ConformanceRunDbUpdate) {
    await this.sql`
      UPDATE conformance_evaluation_run
      SET status = ${input.status}, completed_at = ${input.completed_at},
          checked_count = ${input.checked_count}, violation_count = ${input.violation_count},
          error = ${input.error}
      WHERE workspace = ${workspace} AND id = ${id}
    `;
    return await this.getRun(workspace, id);
  }

  async getViolation(workspace: string, id: string) {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${VIOLATION_SELECT} WHERE v.workspace = $1 AND v.id = $2`,
      [workspace, id]
    );
    return rows[0] ? conformanceMappers.violation(rows[0]) : null;
  }

  async listViolations(workspace: string, options: ConformanceViolationListOptions) {
    const where = ['v.workspace = $1'];
    const params: unknown[] = [workspace];
    if (options.check_id) {
      params.push(options.check_id);
      where.push(`v.check_id = $${params.length}`);
    }
    if (options.entity_id) {
      params.push(options.entity_id);
      where.push(`v.entity_id = $${params.length}`);
    }
    if (options.schema_id) {
      params.push(options.schema_id);
      where.push(`e.schema_id = $${params.length}`);
    }
    if (options.owner_id) {
      params.push(options.owner_id);
      where.push(`e.owner = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      where.push(`(${EFFECTIVE_STATUS_SQL}) = $${params.length}`);
    }
    if (options.severity) {
      params.push(options.severity);
      where.push(`v.severity = $${params.length}`);
    }
    const whereSql = where.join(' AND ');
    const countRows = await this.sql.unsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM conformance_violation v
       JOIN catalog_record e ON e.id = v.entity_id AND e.kind = 'entity'
       LEFT JOIN conformance_exemption x ON x.violation_id = v.id AND x.revoked_at IS NULL
       WHERE ${whereSql}`,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${VIOLATION_SELECT} WHERE ${whereSql}
       ORDER BY v.last_seen_at DESC, v.id DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, options.limit, options.offset] as Parameters<typeof this.sql.unsafe>[1]
    );
    return {
      items: mapDatabaseRows(rows, conformanceMappers.violation),
      total: Number(countRows[0]?.count ?? 0)
    };
  }

  async countViolations(workspace: string): Promise<ConformanceViolationCounts> {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT
        COUNT(*) FILTER (WHERE v.status = 'active' AND NOT EXISTS (
          SELECT 1 FROM conformance_exemption x
          WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
            AND (x.expires_at IS NULL OR x.expires_at > NOW())
        )) AS active,
        COUNT(*) FILTER (WHERE v.status = 'acknowledged' AND NOT EXISTS (
          SELECT 1 FROM conformance_exemption x
          WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
            AND (x.expires_at IS NULL OR x.expires_at > NOW())
        )) AS acknowledged,
        COUNT(*) FILTER (WHERE v.status = 'active' AND v.severity = 'warning' AND NOT EXISTS (
          SELECT 1 FROM conformance_exemption x
          WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
            AND (x.expires_at IS NULL OR x.expires_at > NOW())
        )) AS warnings,
        COUNT(*) FILTER (WHERE v.status = 'active' AND v.severity = 'error' AND NOT EXISTS (
          SELECT 1 FROM conformance_exemption x
          WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
            AND (x.expires_at IS NULL OR x.expires_at > NOW())
        )) AS errors,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM conformance_exemption x
          WHERE x.violation_id = v.id AND x.revoked_at IS NULL AND v.status != 'resolved'
            AND (x.expires_at IS NULL OR x.expires_at > NOW())
        )) AS exempt,
        COUNT(*) FILTER (WHERE v.status = 'resolved' AND v.resolved_at >= NOW() - INTERVAL '30 days') AS resolved_recently
      FROM conformance_violation v
      WHERE v.workspace = ${workspace}
    `;
    const row = rows[0];
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
    await this.sql`
      INSERT INTO conformance_violation
        (id, workspace, check_id, entity_id, schema_id, severity, message, evidence, status, first_seen_at, last_seen_at, resolved_at)
      VALUES
        (${input.id}, ${input.workspace}, ${input.check_id}, ${input.entity_id}, ${input.schema_id},
         ${input.severity}, ${input.message}, ${this.json(input.evidence)}, 'active',
         ${input.seen_at}, ${input.seen_at}, NULL)
      ON CONFLICT (workspace, check_id, entity_id) DO UPDATE SET
        schema_id = EXCLUDED.schema_id,
        severity = EXCLUDED.severity,
        message = EXCLUDED.message,
        evidence = EXCLUDED.evidence,
        status = 'active',
        last_seen_at = EXCLUDED.last_seen_at,
        resolved_at = NULL
    `;
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${VIOLATION_SELECT} WHERE v.workspace = $1 AND v.check_id = $2 AND v.entity_id = $3`,
      [input.workspace, input.check_id, input.entity_id]
    );
    const violation = conformanceMappers.violation(rows[0]!);
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
    await this.sql`
      UPDATE conformance_violation
      SET status = ${status}, resolved_at = ${status === 'resolved' ? changedAt : null}
      WHERE workspace = ${workspace} AND id = ${id}
    `;
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
    return await this.getViolation(workspace, id);
  }

  async createViolationEvent(input: ConformanceViolationEventDbCreate) {
    await this.sql`
      INSERT INTO conformance_violation_event
        (id, workspace, violation_id, run_id, event_type, details, occurred_at)
      VALUES
        (${input.id}, ${input.workspace}, ${input.violation_id}, ${input.run_id}, ${input.event_type},
         ${this.json(input.details)}, ${input.occurred_at})
    `;
  }

  async resolveUnseenViolations(
    workspace: string,
    checkId: string,
    seenEntityIds: string[],
    resolvedAt: Date,
    runId: string | null
  ) {
    const unseenFilter =
      seenEntityIds.length === 0
        ? this.sql``
        : this.sql`AND NOT (entity_id = ANY(${seenEntityIds}))`;
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT id FROM conformance_violation
      WHERE workspace = ${workspace}
        AND check_id = ${checkId}
        AND status IN ('active', 'acknowledged')
        ${unseenFilter}
    `;
    if (rows.length === 0) return [];
    await this.sql`
      UPDATE conformance_violation
      SET status = 'resolved', resolved_at = ${resolvedAt}
      WHERE workspace = ${workspace}
        AND check_id = ${checkId}
        AND status IN ('active', 'acknowledged')
        ${unseenFilter}
    `;
    for (const row of rows) {
      await this.createViolationEvent({
        id: randomUUID(),
        workspace,
        violation_id: String(row['id']),
        run_id: runId,
        event_type: 'resolved',
        details: { reason: 'Evaluation no longer matched the entity' },
        occurred_at: resolvedAt
      });
    }
    return rows.map(row => String(row['id']));
  }

  async createExemption(input: ConformanceExemptionDbResult) {
    try {
      await this.sql`
        INSERT INTO conformance_exemption
          (id, workspace, violation_id, reason, expires_at, created_by, created_at, revoked_at)
        VALUES
          (${input.id}, ${input.workspace}, ${input.violation_id}, ${input.reason},
           ${input.expires_at}, ${input.created_by}, ${input.created_at}, ${input.revoked_at})
      `;
      await this.sql`
        UPDATE conformance_violation SET status = 'active'
        WHERE workspace = ${input.workspace} AND id = ${input.violation_id}
      `;
      await this.createViolationEvent({
        id: randomUUID(),
        workspace: input.workspace,
        violation_id: input.violation_id,
        run_id: null,
        event_type: 'exempted',
        details: { reason: input.reason, expiresAt: input.expires_at?.toISOString() ?? null },
        occurred_at: input.created_at
      });
      const rows = await this.sql<Record<string, unknown>[]>`
        SELECT * FROM conformance_exemption WHERE workspace = ${input.workspace} AND id = ${input.id}
      `;
      return conformanceMappers.exemption(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
