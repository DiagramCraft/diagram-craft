import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type {
  ContentReconciliationCreate,
  ContentReconciliationDatabase,
  ContentReconciliationSummary,
  ContentReconciliationUpdate
} from './contentReconciliationDatabase';
import { contentReconciliationMapper } from './contentReconciliationDatabase';

export class PostgresContentReconciliationDatabase
  extends PostgresDatabaseBase
  implements ContentReconciliationDatabase
{
  async createOperation(input: ContentReconciliationCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO content_reconciliation (
          id, workspace, operation, scope, node_ids, payload, state, attempt_count,
          next_attempt_at, last_error, created_at, updated_at, resolved_at
        ) VALUES (
          ${input.id}, ${input.workspace}, ${input.operation}, ${input.scope},
          ${this.json(input.node_ids)}, ${this.json(input.payload)}, 'pending', 0,
          ${input.next_attempt_at}, NULL, ${input.created_at}, ${input.updated_at ?? input.created_at}, NULL
        )
        RETURNING *
      `;
      return contentReconciliationMapper(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getOperation(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM content_reconciliation WHERE id = ${id}
    `;
    return row ? contentReconciliationMapper(row) : null;
  }

  async listDueOperations(workspace: string, now: Date, limit: number) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM content_reconciliation
      WHERE workspace = ${workspace}
        AND state IN ('pending', 'database_committed', 'resolving', 'failed')
        AND next_attempt_at <= ${now}
      ORDER BY next_attempt_at, created_at
      LIMIT ${limit}
    `;
    return mapDatabaseRows(rows, contentReconciliationMapper);
  }

  async updateOperation(id: string, update: ContentReconciliationUpdate) {
    const current = await this.getOperation(id);
    if (!current) return null;
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE content_reconciliation
        SET state = ${update.state ?? current.state},
            payload = ${this.json(update.payload ?? current.payload)},
            attempt_count = ${update.attempt_count ?? current.attempt_count},
            next_attempt_at = ${update.next_attempt_at ?? current.next_attempt_at},
            last_error = ${update.last_error === undefined ? current.last_error : update.last_error},
            updated_at = ${update.updated_at},
            resolved_at = ${update.resolved_at === undefined ? current.resolved_at : update.resolved_at}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ? contentReconciliationMapper(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async summarize(workspace: string): Promise<ContentReconciliationSummary> {
    const [row] = await this.sql<
      {
        pending: number;
        database_committed: number;
        resolving: number;
        failed: number;
        oldest_unresolved_at: Date | null;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE state = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE state = 'database_committed')::int AS database_committed,
        COUNT(*) FILTER (WHERE state = 'resolving')::int AS resolving,
        COUNT(*) FILTER (WHERE state = 'failed')::int AS failed,
        MIN(created_at) FILTER (WHERE state <> 'resolved') AS oldest_unresolved_at
      FROM content_reconciliation
      WHERE workspace = ${workspace}
    `;
    return {
      pending: Number(row?.pending ?? 0),
      database_committed: Number(row?.database_committed ?? 0),
      resolving: Number(row?.resolving ?? 0),
      failed: Number(row?.failed ?? 0),
      oldest_unresolved_at: row?.oldest_unresolved_at ?? null
    };
  }
}
