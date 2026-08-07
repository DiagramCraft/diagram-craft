import type {
  GovernanceReminderConfigDatabase,
  GovernanceReminderConfigDbResult,
  GovernanceReminderConfigDbUpsert
} from './governanceReminderConfigDatabase';
import { PostgresGovernanceCaseConfigDatabase } from './postgresGovernanceCaseConfig';
import type { GovernanceCaseConfigDbResult } from './governanceCaseConfigDatabase';
import type { PostgresSqlClient } from '../../../db/postgresBase';
import { parseGovernanceWorkflowConfig } from '../governanceWorkflowConfig';

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
        reminders: {
          enabled: input.enabled,
          approachingDays: input.approaching_days,
          overdueDays: input.overdue_days
        },
        escalation: {
          enabled: input.escalation_enabled,
          overdueDays: 1,
          fallbackUserIds: [],
          fallbackTeamIds: []
        },
        extensions: {}
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
  enabled: parseGovernanceWorkflowConfig(row.config, row.enabled).reminders?.enabled ?? row.enabled,
  approaching_days:
    parseGovernanceWorkflowConfig(row.config, row.enabled).reminders?.approachingDays ?? [],
  overdue_days: parseGovernanceWorkflowConfig(row.config, row.enabled).reminders?.overdueDays ?? [],
  escalation_enabled:
    parseGovernanceWorkflowConfig(row.config, row.enabled).escalation?.enabled ?? true,
  escalation_overdue_days: parseGovernanceWorkflowConfig(row.config, row.enabled).escalation
    ?.overdueDays,
  escalation_source: parseGovernanceWorkflowConfig(row.config, row.enabled).escalation
    ?.escalationSource,
  escalation_fallback_user_ids: parseGovernanceWorkflowConfig(row.config, row.enabled).escalation
    ?.fallbackUserIds,
  escalation_fallback_team_ids: parseGovernanceWorkflowConfig(row.config, row.enabled).escalation
    ?.fallbackTeamIds,
  updated_at: row.updated_at,
  updated_by: row.updated_by
});
