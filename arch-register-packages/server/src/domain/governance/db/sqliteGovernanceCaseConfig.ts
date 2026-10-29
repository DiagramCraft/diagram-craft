import { randomUUID } from 'node:crypto';
import type {
  GovernanceCaseConfigDatabase,
  GovernanceCaseConfigDbResult,
  GovernanceCaseConfigDbUpsert
} from './governanceCaseConfigDatabase';
import {
  GovernanceCaseConfigScopeConflictError,
  governanceCaseConfigMappers
} from './governanceCaseConfigDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { DatabaseRow } from '../../../db/rowMappers';

export class SqliteGovernanceCaseConfigDatabase
  extends SqliteDatabaseBase
  implements GovernanceCaseConfigDatabase
{
  private hydrate(rows: DatabaseRow[], scopeRows: DatabaseRow[]): GovernanceCaseConfigDbResult[] {
    const byConfig = new Map<string, string[]>();
    for (const scope of scopeRows) {
      const id = String(scope['config_id']);
      byConfig.set(id, [...(byConfig.get(id) ?? []), String(scope['case_subkind'])]);
    }
    return rows.map(row =>
      governanceCaseConfigMappers.config(row, byConfig.get(String(row['id'])) ?? [])
    );
  }

  async getCaseConfig(workspace: string, caseKind: string, caseSubkind: string | null) {
    const row =
      caseSubkind == null
        ? this.get<DatabaseRow>(
            `SELECT * FROM workspace_governance_case_config
             WHERE workspace = ? AND case_kind = ? AND workspace_wide = 1`,
            [workspace, caseKind]
          )
        : this.get<DatabaseRow>(
            `SELECT c.* FROM workspace_governance_case_config c
             JOIN workspace_governance_case_scope s ON s.config_id = c.id
             WHERE s.workspace = ? AND s.case_kind = ? AND s.case_subkind = ?`,
            [workspace, caseKind, caseSubkind]
          );
    return row ? this.withScope(row) : null;
  }

  async getCaseConfigById(workspace: string, id: string) {
    const row = this.get<DatabaseRow>(
      `SELECT * FROM workspace_governance_case_config WHERE workspace = ? AND id = ?`,
      [workspace, id]
    );
    return row ? this.withScope(row) : null;
  }

  private withScope(row: DatabaseRow) {
    const scopeRows = this.all<DatabaseRow>(
      `SELECT config_id, case_subkind FROM workspace_governance_case_scope
       WHERE config_id = ? ORDER BY case_subkind`,
      [String(row['id'])]
    );
    return this.hydrate([row], scopeRows)[0]!;
  }

  async listCaseConfig(workspace: string) {
    const rows = this.all<DatabaseRow>(
      `SELECT * FROM workspace_governance_case_config WHERE workspace = ? ORDER BY case_kind, name, id`,
      [workspace]
    );
    const scopeRows = this.all<DatabaseRow>(
      `SELECT config_id, case_subkind FROM workspace_governance_case_scope
       WHERE workspace = ? ORDER BY case_subkind`,
      [workspace]
    );
    return this.hydrate(rows, scopeRows);
  }

  async listCaseConfigForKind(workspace: string, caseKind: string) {
    const rows = this.all<DatabaseRow>(
      `SELECT * FROM workspace_governance_case_config
       WHERE workspace = ? AND case_kind = ? ORDER BY name, id`,
      [workspace, caseKind]
    );
    const scopeRows = this.all<DatabaseRow>(
      `SELECT config_id, case_subkind FROM workspace_governance_case_scope
       WHERE workspace = ? AND case_kind = ? ORDER BY case_subkind`,
      [workspace, caseKind]
    );
    return this.hydrate(rows, scopeRows);
  }

  async upsertCaseConfig(input: GovernanceCaseConfigDbUpsert) {
    const subkinds = [...new Set(input.case_subkinds)];
    const workspaceWide = subkinds.length === 0;

    const id = this.db.transaction(() => {
      let configId = input.id ?? null;
      if (!configId) {
        const existing = workspaceWide
          ? this.get<DatabaseRow>(
              `SELECT id FROM workspace_governance_case_config
               WHERE workspace = ? AND case_kind = ? AND workspace_wide = 1`,
              [input.workspace, input.case_kind]
            )
          : this.get<DatabaseRow>(
              `SELECT config_id AS id FROM workspace_governance_case_scope
               WHERE workspace = ? AND case_kind = ? AND case_subkind = ?`,
              [input.workspace, input.case_kind, subkinds[0]]
            );
        configId = existing ? String(existing['id']) : randomUUID();
      }

      if (workspaceWide) {
        const taken = this.get<DatabaseRow>(
          `SELECT id FROM workspace_governance_case_config
           WHERE workspace = ? AND case_kind = ? AND workspace_wide = 1 AND id != ?`,
          [input.workspace, input.case_kind, configId]
        );
        if (taken) throw new GovernanceCaseConfigScopeConflictError(input.case_kind, []);
      } else {
        const placeholders = subkinds.map(() => '?').join(', ');
        const conflicts = this.all<DatabaseRow>(
          `SELECT case_subkind FROM workspace_governance_case_scope
           WHERE workspace = ? AND case_kind = ? AND config_id != ?
             AND case_subkind IN (${placeholders}) ORDER BY case_subkind`,
          [input.workspace, input.case_kind, configId, ...subkinds]
        );
        if (conflicts.length > 0) {
          throw new GovernanceCaseConfigScopeConflictError(
            input.case_kind,
            conflicts.map(c => String(c['case_subkind']))
          );
        }
      }

      this.run(
        `INSERT INTO workspace_governance_case_config (
          id, workspace, case_kind, workspace_wide, name, description, enabled, config, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_wide = excluded.workspace_wide,
          enabled = excluded.enabled,
          config = excluded.config,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by,
          name = excluded.name,
          description = excluded.description`,
        [
          configId,
          input.workspace,
          input.case_kind,
          workspaceWide ? 1 : 0,
          input.name ?? null,
          input.description ?? null,
          input.enabled ? 1 : 0,
          JSON.stringify(input.config),
          input.updated_at.toISOString(),
          input.updated_by
        ]
      );
      this.run(`DELETE FROM workspace_governance_case_scope WHERE config_id = ?`, [configId]);
      for (const subkind of subkinds) {
        this.run(
          `INSERT INTO workspace_governance_case_scope (config_id, workspace, case_kind, case_subkind)
           VALUES (?, ?, ?, ?)`,
          [configId, input.workspace, input.case_kind, subkind]
        );
      }
      return configId;
    })();

    return (await this.getCaseConfigById(input.workspace, id))!;
  }

  async deleteCaseConfig(workspace: string, id: string) {
    const result = this.run(
      `DELETE FROM workspace_governance_case_config WHERE workspace = ? AND id = ?`,
      [workspace, id]
    );
    return result.changes > 0;
  }

  async deleteCaseConfigForSubkindOrDescendants(workspace: string, subkindPrefix: string) {
    return this.db.transaction(() => {
      const affected = this.all<DatabaseRow>(
        `SELECT DISTINCT config_id FROM workspace_governance_case_scope
         WHERE workspace = ? AND (case_subkind = ? OR case_subkind LIKE ?)`,
        [workspace, subkindPrefix, `${subkindPrefix}:%`]
      );
      this.run(
        `DELETE FROM workspace_governance_case_scope
         WHERE workspace = ? AND (case_subkind = ? OR case_subkind LIKE ?)`,
        [workspace, subkindPrefix, `${subkindPrefix}:%`]
      );
      this.run(
        `DELETE FROM workspace_governance_case_config
         WHERE workspace = ? AND workspace_wide = 0
           AND NOT EXISTS (
             SELECT 1 FROM workspace_governance_case_scope s
             WHERE s.config_id = workspace_governance_case_config.id
           )`,
        [workspace]
      );
      return affected.length;
    })();
  }
}
