import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type GovernanceReminderConfigDbResult = {
  workspace: string;
  case_kind: string;
  enabled: boolean;
  approaching_days: number[];
  overdue_days: number[];
  escalation_enabled: boolean;
  updated_at: Date;
  updated_by: string | null;
};

export type GovernanceReminderConfigDbUpsert = {
  workspace: string;
  case_kind: string;
  enabled: boolean;
  approaching_days: number[];
  overdue_days: number[];
  escalation_enabled: boolean;
  updated_at: Date;
  updated_by: string | null;
};

export const governanceReminderConfigMappers = {
  config: (row: DatabaseRow): GovernanceReminderConfigDbResult => ({
    workspace: String(row['workspace']),
    case_kind: String(row['case_kind']),
    enabled: databaseBoolean(row['enabled']),
    approaching_days: parseDatabaseJson(row['approaching_days'], [], 'approaching_days'),
    overdue_days: parseDatabaseJson(row['overdue_days'], [], 'overdue_days'),
    escalation_enabled: databaseBoolean(row['escalation_enabled']),
    updated_at: databaseDate(row['updated_at']),
    updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
  })
};

/**
 * Per-workspace, per-case-kind override of the reminder day thresholds a governance case kind
 * declares as its code default (`GovernanceCaseKindConfig.reminderWindows`). A missing row for a
 * given (workspace, case_kind) means the code default applies as-is — see
 * governanceDeadlineScanJob.ts for how the two are merged.
 */
export type GovernanceReminderConfigDatabase = {
  getReminderConfig(
    workspace: string,
    caseKind: string
  ): Promise<GovernanceReminderConfigDbResult | null>;
  listReminderConfig(workspace: string): Promise<GovernanceReminderConfigDbResult[]>;
  upsertReminderConfig(
    input: GovernanceReminderConfigDbUpsert
  ): Promise<GovernanceReminderConfigDbResult>;
};
