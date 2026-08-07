import { randomUUID } from 'node:crypto';
import type {
  GovernanceCaseConfigDatabase,
  GovernanceCaseConfigDbUpsert
} from './governanceCaseConfigDatabase';
import { governanceCaseConfigMappers } from './governanceCaseConfigDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteGovernanceCaseConfigDatabase
  extends SqliteDatabaseBase
  implements GovernanceCaseConfigDatabase
{
  async getCaseConfig(workspace: string, caseKind: string, caseSubkind: string | null) {
    if (caseSubkind == null) {
      return this.get(
        `SELECT * FROM workspace_governance_case_config
         WHERE workspace = ? AND case_kind = ? AND case_subkind IS NULL`,
        [workspace, caseKind],
        governanceCaseConfigMappers.config
      );
    }
    return this.get(
      `SELECT * FROM workspace_governance_case_config
       WHERE workspace = ? AND case_kind = ? AND case_subkind = ?`,
      [workspace, caseKind, caseSubkind],
      governanceCaseConfigMappers.config
    );
  }

  async listCaseConfig(workspace: string) {
    return this.all(
      `SELECT * FROM workspace_governance_case_config WHERE workspace = ?
       ORDER BY case_kind, case_subkind`,
      [workspace],
      governanceCaseConfigMappers.config
    );
  }

  async listCaseConfigForKind(workspace: string, caseKind: string) {
    return this.all(
      `SELECT * FROM workspace_governance_case_config
       WHERE workspace = ? AND case_kind = ? ORDER BY case_subkind`,
      [workspace, caseKind],
      governanceCaseConfigMappers.config
    );
  }

  async upsertCaseConfig(input: GovernanceCaseConfigDbUpsert) {
    this.run(
      `INSERT INTO workspace_governance_case_config (
        id, workspace, case_kind, case_subkind, enabled, config, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace, case_kind, COALESCE(case_subkind, '')) DO UPDATE SET
        enabled = excluded.enabled,
        config = excluded.config,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`,
      [
        randomUUID(),
        input.workspace,
        input.case_kind,
        input.case_subkind,
        input.enabled ? 1 : 0,
        JSON.stringify(input.config),
        input.updated_at.toISOString(),
        input.updated_by
      ]
    );
    return (await this.getCaseConfig(input.workspace, input.case_kind, input.case_subkind))!;
  }
}
