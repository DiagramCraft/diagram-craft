import type {
  GovernanceReminderConfigDatabase,
  GovernanceReminderConfigDbUpsert
} from './governanceReminderConfigDatabase';
import { governanceReminderConfigMappers } from './governanceReminderConfigDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteGovernanceReminderConfigDatabase
  extends SqliteDatabaseBase
  implements GovernanceReminderConfigDatabase
{
  async getReminderConfig(workspace: string, caseKind: string) {
    return this.get(
      'SELECT * FROM workspace_governance_reminder_config WHERE workspace = ? AND case_kind = ?',
      [workspace, caseKind],
      governanceReminderConfigMappers.config
    );
  }

  async listReminderConfig(workspace: string) {
    return this.all(
      'SELECT * FROM workspace_governance_reminder_config WHERE workspace = ? ORDER BY case_kind',
      [workspace],
      governanceReminderConfigMappers.config
    );
  }

  async upsertReminderConfig(input: GovernanceReminderConfigDbUpsert) {
    this.run(
      `INSERT INTO workspace_governance_reminder_config (
        workspace, case_kind, enabled, approaching_days, overdue_days, escalation_enabled,
        updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace, case_kind) DO UPDATE SET
        enabled = excluded.enabled,
        approaching_days = excluded.approaching_days,
        overdue_days = excluded.overdue_days,
        escalation_enabled = excluded.escalation_enabled,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`,
      [
        input.workspace,
        input.case_kind,
        input.enabled ? 1 : 0,
        JSON.stringify(input.approaching_days),
        JSON.stringify(input.overdue_days),
        input.escalation_enabled ? 1 : 0,
        input.updated_at.toISOString(),
        input.updated_by
      ]
    );
    return (await this.getReminderConfig(input.workspace, input.case_kind))!;
  }
}
