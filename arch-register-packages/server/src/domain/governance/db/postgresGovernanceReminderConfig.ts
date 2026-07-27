import type {
  GovernanceReminderConfigDatabase,
  GovernanceReminderConfigDbUpsert
} from './governanceReminderConfigDatabase';
import { governanceReminderConfigMappers } from './governanceReminderConfigDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type { DatabaseRow } from '../../../db/rowMappers';
import { mapDatabaseRows } from '../../../db/rowMappers';

export class PostgresGovernanceReminderConfigDatabase
  extends PostgresDatabaseBase
  implements GovernanceReminderConfigDatabase
{
  async getReminderConfig(workspace: string, caseKind: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_reminder_config
      WHERE workspace = ${workspace} AND case_kind = ${caseKind}
    `;
    return row ? governanceReminderConfigMappers.config(row) : null;
  }

  async listReminderConfig(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_governance_reminder_config WHERE workspace = ${workspace}
      ORDER BY case_kind
    `;
    return mapDatabaseRows(rows, governanceReminderConfigMappers.config);
  }

  async upsertReminderConfig(input: GovernanceReminderConfigDbUpsert) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace_governance_reminder_config (
          workspace, case_kind, enabled, approaching_days, overdue_days, updated_at, updated_by
        ) VALUES (
          ${input.workspace}, ${input.case_kind}, ${input.enabled},
          ${this.json(input.approaching_days)}, ${this.json(input.overdue_days)},
          ${input.updated_at}, ${input.updated_by}
        )
        ON CONFLICT (workspace, case_kind) DO UPDATE
        SET enabled = ${input.enabled},
            approaching_days = ${this.json(input.approaching_days)},
            overdue_days = ${this.json(input.overdue_days)},
            updated_at = ${input.updated_at},
            updated_by = ${input.updated_by}
        RETURNING *
      `;
      return governanceReminderConfigMappers.config(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
