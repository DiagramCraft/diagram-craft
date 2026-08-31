import type {
  GovernanceCaseConfigDatabase,
  GovernanceCaseConfigDbUpsert
} from './governanceCaseConfigDatabase';
import { governanceCaseConfigMappers } from './governanceCaseConfigDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type { DatabaseRow } from '../../../db/rowMappers';
import { mapDatabaseRows } from '../../../db/rowMappers';
import { randomUUID } from 'node:crypto';

export class PostgresGovernanceCaseConfigDatabase
  extends PostgresDatabaseBase
  implements GovernanceCaseConfigDatabase
{
  async getCaseConfig(workspace: string, caseKind: string, caseSubkind: string | null) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_case_config
      WHERE workspace = ${workspace} AND case_kind = ${caseKind}
        AND case_subkind IS NOT DISTINCT FROM ${caseSubkind}
    `;
    return row ? governanceCaseConfigMappers.config(row) : null;
  }

  async listCaseConfig(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_case_config WHERE workspace = ${workspace}
      ORDER BY case_kind, case_subkind
    `;
    return mapDatabaseRows(rows, governanceCaseConfigMappers.config);
  }

  async listCaseConfigForKind(workspace: string, caseKind: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_case_config
      WHERE workspace = ${workspace} AND case_kind = ${caseKind}
      ORDER BY case_subkind
    `;
    return mapDatabaseRows(rows, governanceCaseConfigMappers.config);
  }

  async upsertCaseConfig(input: GovernanceCaseConfigDbUpsert) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace_governance_case_config (
          id, workspace, case_kind, case_subkind, name, description, enabled, config, updated_at, updated_by
        ) VALUES (
          ${randomUUID()}, ${input.workspace}, ${input.case_kind}, ${input.case_subkind},
          ${input.name}, ${input.description ?? null}, ${input.enabled},
          ${this.json(input.config)}, ${input.updated_at}, ${input.updated_by}
        )
        ON CONFLICT (workspace, case_kind, COALESCE(case_subkind, '')) DO UPDATE
        SET enabled = ${input.enabled},
            config = ${this.json(input.config)},
            updated_at = ${input.updated_at},
            updated_by = ${input.updated_by},
            name = excluded.name,
            description = excluded.description
        RETURNING *
      `;
      return governanceCaseConfigMappers.config(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteCaseConfig(workspace: string, caseKind: string, caseSubkind: string | null) {
    const rows = await this.sql<DatabaseRow[]>`
      DELETE FROM workspace_governance_case_config
      WHERE workspace = ${workspace} AND case_kind = ${caseKind}
        AND case_subkind IS NOT DISTINCT FROM ${caseSubkind}
      RETURNING id
    `;
    return rows.length > 0;
  }

  async deleteCaseConfigForSubkindOrDescendants(workspace: string, subkindPrefix: string) {
    const rows = await this.sql<DatabaseRow[]>`
      DELETE FROM workspace_governance_case_config
      WHERE workspace = ${workspace}
        AND (case_subkind = ${subkindPrefix} OR case_subkind LIKE ${`${subkindPrefix}:%`})
      RETURNING id
    `;
    return rows.length;
  }
}
