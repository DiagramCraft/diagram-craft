import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  ContentReconciliationCreate,
  ContentReconciliationDatabase,
  ContentReconciliationSummary,
  ContentReconciliationUpdate
} from './contentReconciliationDatabase';
import { contentReconciliationMapper } from './contentReconciliationDatabase';

const iso = (date: Date) => date.toISOString();

export class SqliteContentReconciliationDatabase
  extends SqliteDatabaseBase
  implements ContentReconciliationDatabase
{
  async createOperation(input: ContentReconciliationCreate) {
    const updatedAt = input.updated_at ?? input.created_at;
    this.run(
      `INSERT INTO content_reconciliation (
        id, workspace, operation, scope, node_ids, payload, state, attempt_count,
        next_attempt_at, last_error, created_at, updated_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, NULL, ?, ?, NULL)`,
      [
        input.id,
        input.workspace,
        input.operation,
        input.scope,
        JSON.stringify(input.node_ids),
        JSON.stringify(input.payload),
        iso(input.next_attempt_at),
        iso(input.created_at),
        iso(updatedAt)
      ]
    );
    return (await this.get(
      'SELECT * FROM content_reconciliation WHERE id = ?',
      [input.id],
      contentReconciliationMapper
    ))!;
  }

  async getOperation(id: string) {
    return this.get(
      'SELECT * FROM content_reconciliation WHERE id = ?',
      [id],
      contentReconciliationMapper
    );
  }

  async listDueOperations(workspace: string, now: Date, limit: number) {
    return this.all(
      `SELECT * FROM content_reconciliation
       WHERE workspace = ?
         AND state IN ('pending', 'database_committed', 'resolving', 'failed')
         AND next_attempt_at <= ?
       ORDER BY next_attempt_at, created_at
       LIMIT ?`,
      [workspace, iso(now), limit],
      contentReconciliationMapper
    );
  }

  async updateOperation(id: string, update: ContentReconciliationUpdate) {
    const current = await this.getOperation(id);
    if (!current) return null;
    const next = {
      state: update.state ?? current.state,
      payload: update.payload ?? current.payload,
      attemptCount: update.attempt_count ?? current.attempt_count,
      nextAttemptAt: update.next_attempt_at ?? current.next_attempt_at,
      lastError: update.last_error === undefined ? current.last_error : update.last_error,
      resolvedAt: update.resolved_at === undefined ? current.resolved_at : update.resolved_at
    };
    this.run(
      `UPDATE content_reconciliation
       SET state = ?, payload = ?, attempt_count = ?, next_attempt_at = ?, last_error = ?,
           updated_at = ?, resolved_at = ?
       WHERE id = ?`,
      [
        next.state,
        JSON.stringify(next.payload),
        next.attemptCount,
        iso(next.nextAttemptAt),
        next.lastError,
        iso(update.updated_at),
        next.resolvedAt == null ? null : iso(next.resolvedAt),
        id
      ]
    );
    return this.getOperation(id);
  }

  async summarize(workspace: string): Promise<ContentReconciliationSummary> {
    const row = this.get<{
      pending: number;
      database_committed: number;
      resolving: number;
      failed: number;
      oldest_unresolved_at: string | null;
    }>(
      `SELECT
         SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN state = 'database_committed' THEN 1 ELSE 0 END) AS database_committed,
         SUM(CASE WHEN state = 'resolving' THEN 1 ELSE 0 END) AS resolving,
         SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) AS failed,
         MIN(CASE WHEN state NOT IN ('resolved') THEN created_at ELSE NULL END) AS oldest_unresolved_at
       FROM content_reconciliation
       WHERE workspace = ?`,
      [workspace]
    );
    return {
      pending: Number(row?.pending ?? 0),
      database_committed: Number(row?.database_committed ?? 0),
      resolving: Number(row?.resolving ?? 0),
      failed: Number(row?.failed ?? 0),
      oldest_unresolved_at:
        row?.oldest_unresolved_at == null ? null : new Date(row.oldest_unresolved_at)
    };
  }
}
