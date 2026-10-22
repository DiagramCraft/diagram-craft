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
  /** Empty for the workspace-wide (fallback) config; otherwise the subkinds this config covers. */
  case_subkinds: string[];
  name: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: Date;
  updated_by: string | null;
};

export type GovernanceCaseConfigDbUpsert = {
  /**
   * When set, updates (or inserts with this id) that config. When omitted, the config currently
   * covering the first subkind (or the workspace-wide config when `case_subkinds` is empty) is
   * updated, or a new one is created.
   */
  id?: string;
  workspace: string;
  case_kind: string;
  /** Empty means workspace-wide. A config is never both workspace-wide and subkind-scoped. */
  case_subkinds: string[];
  name: string;
  description?: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: Date;
  updated_by: string | null;
};

/** Thrown by `upsertCaseConfig` when another config already covers one of the requested subkinds. */
export class GovernanceCaseConfigScopeConflictError extends Error {
  constructor(
    readonly caseKind: string,
    /** Conflicting subkinds; empty when the workspace-wide slot is taken. */
    readonly subkinds: string[]
  ) {
    super(
      subkinds.length === 0
        ? `A workspace-wide '${caseKind}' workflow configuration already exists`
        : `Subkinds already covered by another '${caseKind}' workflow configuration: ${subkinds.join(', ')}`
    );
    this.name = 'GovernanceCaseConfigScopeConflictError';
  }
}

export const governanceCaseConfigMappers = {
  config: (row: DatabaseRow, subkinds: string[] = []): GovernanceCaseConfigDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    case_kind: String(row['case_kind']),
    case_subkinds: subkinds,
    name: String(row['name']),
    description: row['description'] == null ? null : String(row['description']),
    enabled: databaseBoolean(row['enabled']),
    config: parseDatabaseJson(row['config'], {}, 'workspace_governance_case_config.config'),
    updated_at: databaseDate(row['updated_at']),
    updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
  })
};

/**
 * Generalized per-(workspace, case_kind) governance config store. A config is either
 * workspace-wide (`case_subkinds` empty; at most one per case kind) or scoped to one or more
 * subkinds (e.g. schema ids, or `schemaId:fieldId` for field-scoped kinds). A subkind is covered by
 * at most one config per case kind, enforced by the database. `config` is an opaque JSONB blob
 * whose shape is validated only at the API boundary, per case kind — not enforced by the DB,
 * mirroring `workspace_automation_rule`.
 */
export type GovernanceCaseConfigDatabase = {
  /** `caseSubkind` null returns the workspace-wide config; otherwise the config covering it. */
  getCaseConfig(
    workspace: string,
    caseKind: string,
    caseSubkind: string | null
  ): Promise<GovernanceCaseConfigDbResult | null>;
  getCaseConfigById(workspace: string, id: string): Promise<GovernanceCaseConfigDbResult | null>;
  listCaseConfig(workspace: string): Promise<GovernanceCaseConfigDbResult[]>;
  listCaseConfigForKind(
    workspace: string,
    caseKind: string
  ): Promise<GovernanceCaseConfigDbResult[]>;
  /** @throws GovernanceCaseConfigScopeConflictError when the requested scope overlaps another config */
  upsertCaseConfig(input: GovernanceCaseConfigDbUpsert): Promise<GovernanceCaseConfigDbResult>;
  deleteCaseConfig(workspace: string, id: string): Promise<boolean>;
  /**
   * Removes every scope entry equal to `subkindPrefix` or addressing a field under it
   * (`subkindPrefix:anyFieldId`) — used to cascade-clean config when the schema, document type, or
   * field a subkind addresses is deleted. Configs left with no scope (and not workspace-wide) are
   * deleted. Returns the number of configs affected. See `governanceCaseSubkind.ts`.
   */
  deleteCaseConfigForSubkindOrDescendants(
    workspace: string,
    subkindPrefix: string
  ): Promise<number>;
};
