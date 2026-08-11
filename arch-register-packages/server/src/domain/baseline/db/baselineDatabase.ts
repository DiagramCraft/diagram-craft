import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { BaselineScope } from '@arch-register/api-types/baselineContract';
import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type BaselineDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  owner_team_id: string | null;
  created_by: string | null;
  effective_at: Date;
  scope: BaselineScope;
  query: EntityQuery | null;
  include_planned_changes: boolean;
  include_overdue_changes: boolean;
  superseded_by_id: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  created_at: Date;
  entity_count: number;
  relation_count: number;
};

export type BaselineDbCreate = Omit<
  BaselineDbResult,
  'superseded_by_id' | 'deleted_at' | 'deleted_by'
> & {
  superseded_by_id?: string | null;
  deleted_at?: Date | null;
  deleted_by?: string | null;
};

export type BaselineRecordKind = 'entity' | 'relation';
export type BaselineLinkTargetType =
  | 'project'
  | 'milestone'
  | 'planned_change'
  | 'document'
  | 'governance_case';

export type BaselineLinkDbResult = {
  id: string;
  workspace: string;
  baseline_id: string;
  target_type: BaselineLinkTargetType;
  target_id: string;
  created_by: string | null;
  created_at: Date;
};

export type BaselineLinkDbCreate = Omit<BaselineLinkDbResult, 'id'> & { id?: string };

export type BaselineRecordDbResult = {
  id: string;
  workspace: string;
  baseline_id: string;
  record_kind: BaselineRecordKind;
  record_id: string;
  state: Record<string, unknown>;
  schema: Record<string, unknown> | null;
  state_hash: string;
  position: number;
};

export type BaselineRecordDbCreate = Omit<BaselineRecordDbResult, 'id'> & {
  id?: string;
};

export type BaselineDatabase = {
  listBaselines(workspace: string, includeDeleted?: boolean): Promise<BaselineDbResult[]>;
  getBaseline(
    workspace: string,
    id: string,
    includeDeleted?: boolean
  ): Promise<BaselineDbResult | null>;
  createBaseline(input: BaselineDbCreate): Promise<BaselineDbResult>;
  insertBaselineRecords(input: BaselineRecordDbCreate[]): Promise<void>;
  listBaselineRecords(workspace: string, baselineId: string): Promise<BaselineRecordDbResult[]>;
  listBaselineLinks(workspace: string, baselineId: string): Promise<BaselineLinkDbResult[]>;
  createBaselineLink(input: BaselineLinkDbCreate): Promise<BaselineLinkDbResult>;
  deleteBaselineLink(
    workspace: string,
    baselineId: string,
    linkId: string
  ): Promise<BaselineLinkDbResult | null>;
  setSupersededBy(workspace: string, id: string, replacementId: string): Promise<BaselineDbResult | null>;
  softDelete(workspace: string, id: string, deletedBy: string, deletedAt: Date): Promise<BaselineDbResult | null>;
};

const booleanValue = (value: unknown) => value === true || value === 1 || value === '1';

export const baselineMappers = {
  baseline: (row: DatabaseRow): BaselineDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: row['description'] == null ? null : String(row['description']),
    owner_team_id: row['owner_team_id'] == null ? null : String(row['owner_team_id']),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    effective_at: databaseDate(row['effective_at']),
    scope: parseDatabaseJson<BaselineScope>(row['scope_json'], { kind: 'workspace' }, 'baseline.scope_json'),
    query: parseDatabaseJson<EntityQuery | null>(row['query_json'], null, 'baseline.query_json'),
    include_planned_changes: booleanValue(row['include_planned_changes']),
    include_overdue_changes: booleanValue(row['include_overdue_changes']),
    superseded_by_id: row['superseded_by_id'] == null ? null : String(row['superseded_by_id']),
    deleted_at: row['deleted_at'] == null ? null : databaseDate(row['deleted_at']),
    deleted_by: row['deleted_by'] == null ? null : String(row['deleted_by']),
    created_at: databaseDate(row['created_at']),
    entity_count: Number(row['entity_count'] ?? 0),
    relation_count: Number(row['relation_count'] ?? 0)
  }),
  record: (row: DatabaseRow): BaselineRecordDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    baseline_id: String(row['baseline_id']),
    record_kind: String(row['record_kind']) as BaselineRecordKind,
    record_id: String(row['record_id']),
    state: parseDatabaseJson<Record<string, unknown>>(row['state_json'], {}, 'baseline_record.state_json'),
    schema: parseDatabaseJson<Record<string, unknown> | null>(
      row['schema_json'],
      null,
      'baseline_record.schema_json'
    ),
    state_hash: String(row['state_hash']),
    position: Number(row['position'] ?? 0)
  }),
  link: (row: DatabaseRow): BaselineLinkDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    baseline_id: String(row['baseline_id']),
    target_type: String(row['target_type']) as BaselineLinkTargetType,
    target_id: String(row['target_id']),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    created_at: databaseDate(row['created_at'])
  })
};
