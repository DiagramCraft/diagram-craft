import type {
  MergeBlocker,
  MergeFieldConflict,
  MergePreview,
  MergeExecuteBody
} from '@arch-register/api-types/entityMergeContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';

export type FieldResolution = 'source' | 'target';
export type ConflictResolution = 'keep_source' | 'keep_target' | 'drop_source';

export type MergeResolutionMaps = {
  fieldResolutions: Record<string, FieldResolution>;
  relationResolutions: Record<string, ConflictResolution>;
  sideTableResolutions: Record<string, ConflictResolution>;
};

// Every field/relation/side-table conflict the preview returns must have a resolution present in
// the execute body, or the server 409s (`validateExecuteResolutions`). Default everything to the
// non-destructive "keep target" choice so a user who touches nothing still submits a valid,
// harmless request; a `note: 'self'` relation conflict must resolve to `drop_source` (the server
// 400s on anything else), so it's forced regardless of the default.
export const buildDefaultResolutions = (preview: MergePreview): MergeResolutionMaps => ({
  fieldResolutions: Object.fromEntries(
    preview.fieldConflicts.map(conflict => [conflict.fieldKey, 'target' as FieldResolution])
  ),
  relationResolutions: Object.fromEntries(
    preview.relationConflicts.map(conflict => [
      conflict.relationId,
      (conflict.note === 'self' ? 'drop_source' : 'keep_target') as ConflictResolution
    ])
  ),
  sideTableResolutions: Object.fromEntries(
    preview.sideTableConflicts.map(conflict => [
      conflict.conflictId,
      'keep_target' as ConflictResolution
    ])
  )
});

// True when at least one blocker still prevents the merge from proceeding: any non-acknowledgeable
// blocker, or an acknowledgeable one the caller hasn't checked off yet.
export const isMergeBlockedHard = (
  blockers: MergeBlocker[],
  acknowledged: ReadonlySet<string>
): boolean => blockers.some(blocker => !blocker.acknowledgeable || !acknowledged.has(blocker.code));

export const buildMergeExecuteBody = (
  preview: MergePreview,
  resolutions: MergeResolutionMaps,
  acknowledgedBlockers: ReadonlySet<string>
): MergeExecuteBody => ({
  targetId: preview.targetId,
  expectedSourceVersion: preview.sourceVersion,
  expectedTargetVersion: preview.targetVersion,
  previewFingerprint: preview.previewFingerprint,
  fieldResolutions: resolutions.fieldResolutions,
  relationResolutions: resolutions.relationResolutions,
  sideTableResolutions: resolutions.sideTableResolutions,
  acknowledgedBlockers: [...acknowledgedBlockers]
});

// `fieldKey` for a non-restricted data-field conflict is `data:<schema field id>`; restricted
// conflicts use an opaque `data:<fingerprint>` that intentionally doesn't resolve to a real field,
// so this only ever matters for the non-restricted case.
const schemaFieldIdFromKey = (fieldKey: string): string | null =>
  fieldKey.startsWith('data:') ? fieldKey.slice('data:'.length) : null;

const referenceSchemaField = (conflict: MergeFieldConflict, schema: EntitySchema | null) => {
  if (conflict.kind !== 'data' || conflict.restricted) return null;
  const fieldId = schemaFieldIdFromKey(conflict.fieldKey);
  if (!fieldId) return null;
  const field = schema?.fields.find(f => f.id === fieldId);
  return field && isReferenceOrContainmentField(field) ? field : null;
};

export const isReferenceFieldConflict = (
  conflict: MergeFieldConflict,
  schema: EntitySchema | null
): boolean => referenceSchemaField(conflict, schema) != null;

// Reference/containment field values are stored as arrays of the related entities' internal ids
// (see `relationIds` in lib/entityEditState.ts) — collect every id across every reference-field
// conflict's source and target values so the caller can batch-resolve them to display names.
export const collectReferenceFieldConflictIds = (
  conflicts: MergeFieldConflict[],
  schema: EntitySchema | null
): string[] => {
  const ids = new Set<string>();
  for (const conflict of conflicts) {
    if (!isReferenceFieldConflict(conflict, schema)) continue;
    for (const value of [conflict.source, conflict.target]) {
      if (!Array.isArray(value)) continue;
      for (const id of value) {
        if (typeof id === 'string') ids.add(id);
      }
    }
  }
  return [...ids];
};

export const formatMergeReferenceValue = (
  value: unknown,
  refLookup: ReadonlyMap<string, { name: string }>
): string => {
  if (!Array.isArray(value) || value.length === 0) return '—';
  return value
    .map(id => (typeof id === 'string' ? (refLookup.get(id)?.name ?? id) : String(id)))
    .join(', ');
};

// Core-field conflicts diff the raw stored entity row (see `mutableStateKeys` in
// entityDiff.ts server-side), so `owner`/`lifecycle`/`target_lifecycle` come back as bare ids,
// not the `{id, name}` shape the API's EntityRecord exposes elsewhere. Resolve them against data
// the workspace already loads (teams, lifecycle states) instead of showing raw uuids.
const CORE_TEAM_FIELD_KEYS = new Set(['core:owner']);
const CORE_LIFECYCLE_FIELD_KEYS = new Set(['core:lifecycle', 'core:target_lifecycle']);

export const isLookupCoreFieldConflict = (conflict: MergeFieldConflict): boolean =>
  conflict.kind === 'core' &&
  (CORE_TEAM_FIELD_KEYS.has(conflict.fieldKey) || CORE_LIFECYCLE_FIELD_KEYS.has(conflict.fieldKey));

export type CoreFieldLookups = {
  teamNames: ReadonlyMap<string, string>;
  lifecycleLabels: ReadonlyMap<string, string>;
};

export const formatMergeCoreFieldValue = (
  conflict: MergeFieldConflict,
  value: unknown,
  lookups: CoreFieldLookups
): string => {
  if (typeof value !== 'string' || value === '') return '—';
  if (CORE_TEAM_FIELD_KEYS.has(conflict.fieldKey)) return lookups.teamNames.get(value) ?? value;
  if (CORE_LIFECYCLE_FIELD_KEYS.has(conflict.fieldKey)) {
    return lookups.lifecycleLabels.get(value) ?? value;
  }
  return formatMergeFieldValue(value);
};

export const formatMergeFieldValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)))
      .join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const SIDE_TABLE_LABELS: Record<string, string> = {
  entity_grant: 'Access grants',
  content_node: 'Content nodes',
  content_mount: 'Content mounts',
  diagram_entity_ref: 'Diagram references',
  user_watch: 'Watches',
  user_notification: 'Notifications',
  user_pinned_entity: 'Pinned entities',
  user_collection_entity: 'Collections',
  project_entity: 'Project links',
  assessment_response: 'Assessment responses',
  document_link_index: 'Document links',
  record_change_case_record_version: 'Change case records',
  entity_deprecation_ack: 'Deprecation acknowledgements',
  catalog_artifact: 'Artifacts',
  conformance_violation: 'Conformance violations',
  conformance_entity_evaluation: 'Conformance evaluations'
};

export const formatSideTableLabel = (table: string): string => SIDE_TABLE_LABELS[table] ?? table;
