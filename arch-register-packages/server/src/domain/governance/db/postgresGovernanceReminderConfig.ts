import type {
  GovernanceReminderConfigDatabase,
  GovernanceReminderConfigDbResult,
  GovernanceReminderConfigDbUpsert
} from './governanceReminderConfigDatabase';
import { PostgresGovernanceCaseConfigDatabase } from './postgresGovernanceCaseConfig';
import type { GovernanceCaseConfigDbResult } from './governanceCaseConfigDatabase';
import type { PostgresSqlClient } from '../../../db/postgresBase';

/**
 * Reminder config is stored as workspace-wide (`case_subkind: null`) rows in the generalized
 * `workspace_governance_case_config` table, with `config` holding
 * `{ approaching_days, overdue_days, escalation_enabled }`. This class preserves the pre-#2818
 * `GovernanceReminderConfigDatabase` interface so `governanceReminderConfigOrpc.ts` and
 * `governanceDeadlineScanJob.ts` don't need to change.
 */
export class PostgresGovernanceReminderConfigDatabase implements GovernanceReminderConfigDatabase {
  private readonly caseConfig: PostgresGovernanceCaseConfigDatabase;

  constructor(sql: PostgresSqlClient) {
    this.caseConfig = new PostgresGovernanceCaseConfigDatabase(sql);
  }

  async getReminderConfig(workspace: string, caseKind: string) {
    const row = await this.caseConfig.getCaseConfig(workspace, caseKind, null);
    return row ? toReminderConfig(row) : null;
  }

  async listReminderConfig(workspace: string) {
    const rows = await this.caseConfig.listCaseConfig(workspace);
    return rows
      .filter(row => row.case_subkind == null)
      .map(toReminderConfig)
      .sort((a, b) => a.case_kind.localeCompare(b.case_kind));
  }

  async upsertReminderConfig(
    input: GovernanceReminderConfigDbUpsert
  ): Promise<GovernanceReminderConfigDbResult> {
    const row = await this.caseConfig.upsertCaseConfig({
      workspace: input.workspace,
      case_kind: input.case_kind,
      case_subkind: null,
      enabled: input.enabled,
      config: {
        approaching_days: input.approaching_days,
        overdue_days: input.overdue_days,
        escalation_enabled: input.escalation_enabled
      },
      updated_at: input.updated_at,
      updated_by: input.updated_by
    });
    return toReminderConfig(row);
  }
}

const toReminderConfig = (row: GovernanceCaseConfigDbResult): GovernanceReminderConfigDbResult => ({
  workspace: row.workspace,
  case_kind: row.case_kind,
  enabled: row.enabled,
  approaching_days: Array.isArray(row.config['approaching_days'])
    ? (row.config['approaching_days'] as number[])
    : [],
  overdue_days: Array.isArray(row.config['overdue_days'])
    ? (row.config['overdue_days'] as number[])
    : [],
  escalation_enabled: row.config['escalation_enabled'] !== false,
  updated_at: row.updated_at,
  updated_by: row.updated_by
});
