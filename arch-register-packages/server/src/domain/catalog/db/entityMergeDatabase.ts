import { createHash } from 'node:crypto';
import type {
  MergeRelationConflict,
  MergeSideTableConflict
} from '@arch-register/api-types/entityMergeContract';
import type { RelationDbResult } from './relationDatabase';

export const mergeSideTableNames = [
  'entity_grant',
  'content_node',
  'content_mount',
  'diagram_entity_ref',
  'user_watch',
  'user_notification',
  'user_pinned_entity',
  'user_collection_entity',
  'project_entity',
  'assessment_response',
  'document_link_index',
  'record_change_case_record_version',
  'entity_deprecation_ack',
  'catalog_artifact',
  'conformance_violation',
  'conformance_entity_evaluation'
] as const;

export type MergeSideTableName = (typeof mergeSideTableNames)[number];
export type MergeTrackedTable =
  | MergeSideTableName
  | 'record_version'
  | 'discussion_post'
  | 'governance_case';

export type MergeSideTableRow = {
  table: MergeTrackedTable;
  rowId: string;
  entityId: string;
  uniqueKey: string | null;
  /** Stable content identity after replacing the entity reference; used for auto-deduplication. */
  dedupeKey: string | null;
};

export type MergeExternalIdentityRow = {
  source: string;
  externalKey: string;
  recordId: string;
};

export type EntityMergeSideTableSnapshot = {
  rows: MergeSideTableRow[];
  conflicts: MergeSideTableConflict[];
  externalIdentityRows: MergeExternalIdentityRow[];
};

export type MergeRelationResolution = 'keep_source' | 'keep_target' | 'drop_source';

export type EntityMergeDatabase = {
  getSideTableSnapshot(
    workspace: string,
    sourceId: string,
    targetId: string
  ): Promise<EntityMergeSideTableSnapshot>;
  lockRecords(workspace: string, recordIds: string[]): Promise<void>;
  releaseSourceIdentity(
    workspace: string,
    sourceId: string,
    expectedVersion: number,
    temporarySlug: string,
    temporaryNamespace: string
  ): Promise<boolean>;
  applyRelationRewrites(
    workspace: string,
    sourceId: string,
    targetId: string,
    sourceRelations: RelationDbResult[],
    conflicts: MergeRelationConflict[],
    resolutions: Record<string, MergeRelationResolution>
  ): Promise<void>;
  applySideTableRewrites(
    workspace: string,
    sourceId: string,
    targetId: string,
    resolutions: Record<string, MergeRelationResolution>
  ): Promise<void>;
  moveRecordVersions(workspace: string, sourceId: string, targetId: string): Promise<void>;
  deleteSourceRecord(
    workspace: string,
    sourceId: string,
    expectedVersion: number
  ): Promise<boolean>;
  countRemainingReferences(workspace: string, recordId: string): Promise<number>;
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
};

export const mergeRowId = (value: Record<string, unknown>): string => stableStringify(value);

export const mergeRowDedupeKey = (
  row: Record<string, unknown>,
  entityColumn: string,
  idColumns: string[]
): string => {
  const ignoredColumns = new Set([entityColumn, ...idColumns, 'created_at', 'updated_at']);
  return mergeRowId(
    Object.fromEntries(Object.entries(row).filter(([column]) => !ignoredColumns.has(column)))
  );
};

export const mergeSideTableConflictId = (table: string, key: string): string =>
  createHash('sha256').update(`${table}\u0000${key}`).digest('hex');

export const buildMergeSideTableConflicts = (
  rows: MergeSideTableRow[],
  sourceId: string,
  targetId: string
): MergeSideTableConflict[] => {
  const sourceRows = new Map<string, MergeSideTableRow>();
  const targetRows = new Map<string, MergeSideTableRow>();

  for (const row of rows) {
    if (row.uniqueKey == null) continue;
    const key = `${row.table}\u0000${row.uniqueKey}`;
    if (row.entityId === sourceId) sourceRows.set(key, row);
    if (row.entityId === targetId) targetRows.set(key, row);
  }

  const conflicts: MergeSideTableConflict[] = [];
  for (const [key, sourceRow] of sourceRows) {
    const targetRow = targetRows.get(key);
    if (!targetRow) continue;
    if (!(mergeSideTableNames as readonly string[]).includes(sourceRow.table)) continue;
    if (sourceRow.dedupeKey != null && sourceRow.dedupeKey === targetRow.dedupeKey) continue;
    const table = sourceRow.table;
    const conflictTable = table as MergeSideTableName;
    conflicts.push({
      conflictId: mergeSideTableConflictId(conflictTable, sourceRow.uniqueKey!),
      table: conflictTable,
      sourceRowId: sourceRow.rowId,
      targetRowId: targetRow.rowId,
      key: mergeSideTableConflictId(conflictTable, sourceRow.uniqueKey!)
    });
  }
  return conflicts.sort((left, right) => left.conflictId.localeCompare(right.conflictId));
};

export const buildMergeSideTableAutoDedupeRowIds = (
  rows: MergeSideTableRow[],
  sourceId: string,
  targetId: string
): string[] => {
  const sourceRows = new Map<string, MergeSideTableRow>();
  const targetRows = new Map<string, MergeSideTableRow>();

  for (const row of rows) {
    if (row.uniqueKey == null || row.dedupeKey == null) continue;
    if (!(mergeSideTableNames as readonly string[]).includes(row.table)) continue;
    const key = `${row.table}\u0000${row.uniqueKey}`;
    if (row.entityId === sourceId) sourceRows.set(key, row);
    if (row.entityId === targetId) targetRows.set(key, row);
  }

  return [...sourceRows]
    .filter(([key, sourceRow]) => targetRows.get(key)?.dedupeKey === sourceRow.dedupeKey)
    .map(([, sourceRow]) => sourceRow.rowId)
    .sort();
};

export const mergeFingerprint = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

export { stableStringify as mergeStableStringify };
