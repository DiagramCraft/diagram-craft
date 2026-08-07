import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type GovernanceCaseConfigDbResult = {
  id: string;
  workspace: string;
  case_kind: string;
  case_subkind: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: Date;
  updated_by: string | null;
};

export type GovernanceCaseConfigDbUpsert = {
  workspace: string;
  case_kind: string;
  case_subkind: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: Date;
  updated_by: string | null;
};

export const governanceCaseConfigMappers = {
  config: (row: DatabaseRow): GovernanceCaseConfigDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    case_kind: String(row['case_kind']),
    case_subkind: row['case_subkind'] == null ? null : String(row['case_subkind']),
    enabled: databaseBoolean(row['enabled']),
    config: parseDatabaseJson(row['config'], {}, 'workspace_governance_case_config.config'),
    updated_at: databaseDate(row['updated_at']),
    updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
  })
};

/**
 * Generalized per-(workspace, case_kind, case_subkind) governance config store. `case_subkind` is
 * null for workspace-wide config and set for entity/field-scoped overrides (e.g. a specific
 * schema field's reminder cadence). `config` is an opaque JSONB blob whose shape is validated only
 * at the API boundary, per case kind — not enforced by the DB, mirroring
 * `workspace_automation_rule`.
 */
export type GovernanceCaseConfigDatabase = {
  getCaseConfig(
    workspace: string,
    caseKind: string,
    caseSubkind: string | null
  ): Promise<GovernanceCaseConfigDbResult | null>;
  listCaseConfig(workspace: string): Promise<GovernanceCaseConfigDbResult[]>;
  listCaseConfigForKind(
    workspace: string,
    caseKind: string
  ): Promise<GovernanceCaseConfigDbResult[]>;
  upsertCaseConfig(input: GovernanceCaseConfigDbUpsert): Promise<GovernanceCaseConfigDbResult>;
};
