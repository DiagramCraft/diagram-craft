import { ApiSelectField, EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  ASSESSMENT_FIELD_PREFIX,
  resolveAssessmentValue
} from '@arch-register/api-types/assessmentFilter';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { BrowserEntityRecord } from './entityBrowserState';
import { parseTimelineDate } from '../../../components/timeline/timelineUtils';

export const LIFECYCLE_FIELD_ID = '_lifecycle';
export const OWNER_FIELD_ID = '_owner';

export type FieldOption = { id: string; label: string };

export type JoinedAssessmentContext = { assessment: Assessment; enums: WorkspaceEnum[] };

export const RATING_VALUES: FieldOption[] = ['1', '2', '3', '4', '5'].map(v => ({
  id: v,
  label: v
}));

/**
 * Fields are deduped by id across the given schemas (first occurrence wins), the same way
 * MatrixView's attribute-column mode unions select fields across the row schemas present in
 * the current browser results.
 */
const findFieldAcrossSchemas = (schemas: EntitySchema[], fieldId: string) => {
  for (const schema of schemas) {
    const field = schema.fields.find(f => f.id === fieldId);
    if (field) return field;
  }
  return undefined;
};

/**
 * Categorical (discrete-value) fields selectable for an axis or colour mapping.
 *
 * `includeRatingFields` opts in rating-typed assessment fields as a discrete/bucketed axis
 * (e.g. RadarView's quadrant/ring axes, which treat a 1-5 rating as 5 discrete values) —
 * it defaults to false since most callers (e.g. BubbleView) treat rating fields as numeric
 * via `getNumericFields` instead, and offering them in both places would be confusing.
 */
export const getCategoricalFields = (
  schemas: EntitySchema[],
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[],
  joinedAssessment?: JoinedAssessmentContext | null,
  includeRatingFields = false
): FieldOption[] => {
  const seen = new Set<string>();
  const selectFields: FieldOption[] = [];
  schemas.forEach(schema => {
    schema.fields.forEach(f => {
      if (f.type === 'select' && !seen.has(f.id)) {
        seen.add(f.id);
        selectFields.push({ id: f.id, label: f.name });
      }
    });
  });

  return [
    ...selectFields,
    ...(lifecycleStates.length > 0 ? [{ id: LIFECYCLE_FIELD_ID, label: 'Lifecycle' }] : []),
    ...(teams.length > 0 ? [{ id: OWNER_FIELD_ID, label: 'Owner' }] : []),
    ...(joinedAssessment
      ? joinedAssessment.assessment.fields
          .filter(f => f.type === 'enum' || (includeRatingFields && f.type === 'rating'))
          .map(f => ({ id: `${ASSESSMENT_FIELD_PREFIX}${f.id}`, label: f.label }))
      : [])
  ];
};

/** Numeric fields selectable for an axis or size mapping. */
export const getNumericFields = (
  schemas: EntitySchema[],
  joinedAssessment?: JoinedAssessmentContext | null
): FieldOption[] => {
  const seen = new Set<string>();
  const numberFields: FieldOption[] = [];
  schemas.forEach(schema => {
    schema.fields.forEach(f => {
      if (f.type === 'number' && !seen.has(f.id)) {
        seen.add(f.id);
        numberFields.push({ id: f.id, label: f.name });
      }
    });
  });

  return [
    ...numberFields,
    ...(joinedAssessment
      ? joinedAssessment.assessment.fields
          .filter(f => f.type === 'rating')
          .map(f => ({ id: `${ASSESSMENT_FIELD_PREFIX}${f.id}`, label: f.label }))
      : [])
  ];
};

export const getCategoricalFieldValues = (
  schemas: EntitySchema[],
  fieldId: string,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[],
  joinedAssessment?: JoinedAssessmentContext | null
): FieldOption[] => {
  if (fieldId === LIFECYCLE_FIELD_ID) {
    return [...lifecycleStates]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({ id: s.id, label: s.label }));
  }
  if (fieldId === OWNER_FIELD_ID) {
    return [...teams]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(t => ({ id: t.id, label: t.name }));
  }
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX) && joinedAssessment) {
    const assessmentFieldId = fieldId.slice(ASSESSMENT_FIELD_PREFIX.length);
    const field = joinedAssessment.assessment.fields.find(f => f.id === assessmentFieldId);
    if (field?.type === 'rating') return RATING_VALUES;
    if (field?.type === 'enum') {
      const options = joinedAssessment.enums.find(e => e.id === field.enumId)?.options ?? [];
      return options.map(o => ({ id: o.value, label: o.label }));
    }
    return [];
  }
  const field = findFieldAcrossSchemas(schemas, fieldId);
  if (field?.type !== 'select') return [];
  return ((field as ApiSelectField).options ?? []).map(o => ({ id: o.value, label: o.label }));
};

export const getCategoricalValue = (entity: EntityRecord, fieldId: string): string | null => {
  if (fieldId === LIFECYCLE_FIELD_ID) return entity._lifecycle?.id ?? null;
  if (fieldId === OWNER_FIELD_ID) return entity._owner?.id ?? null;
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
    const value = resolveAssessmentValue(entity as BrowserEntityRecord, fieldId);
    return value == null ? null : String(value);
  }
  const val = entity[fieldId];
  return typeof val === 'string' ? val : null;
};

export const getNumericValue = (entity: EntityRecord, fieldId: string): number | null => {
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
    const value = resolveAssessmentValue(entity as BrowserEntityRecord, fieldId);
    return typeof value === 'number' ? value : value != null ? Number(value) : null;
  }
  const val = entity[fieldId];
  return typeof val === 'number' ? val : null;
};

/**
 * Date-typed fields selectable for a date mapping. `extraFields` lets callers append
 * view-specific pseudo-fields (e.g. TimelineView's "Target Lifecycle Date") that aren't a
 * declared schema field.
 */
export const getDateFields = (
  schemas: EntitySchema[],
  extraFields: FieldOption[] = []
): FieldOption[] => {
  const seen = new Set<string>();
  const dateFields: FieldOption[] = [];
  schemas.forEach(schema => {
    schema.fields.forEach(f => {
      if (f.type === 'date' && !seen.has(f.id)) {
        seen.add(f.id);
        dateFields.push({ id: f.id, label: f.name });
      }
    });
  });
  return [...dateFields, ...extraFields];
};

export const getRawDateValue = (entity: EntityRecord, fieldId: string): unknown => entity[fieldId];

export const getDateValue = (entity: EntityRecord, fieldId: string): Date | null =>
  parseTimelineDate(getRawDateValue(entity, fieldId));

export const getNumericFieldRange = (
  schemas: EntitySchema[],
  fieldId: string,
  joinedAssessment: JoinedAssessmentContext | null | undefined,
  entities: EntityRecord[]
): { min: number; max: number } => {
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
    const assessmentFieldId = fieldId.slice(ASSESSMENT_FIELD_PREFIX.length);
    const field = joinedAssessment?.assessment.fields.find(f => f.id === assessmentFieldId);
    if (field?.type === 'rating') return { min: 1, max: 5 };
  }
  const field = findFieldAcrossSchemas(schemas, fieldId);
  // A declared min/max only applies when every schema that defines this field id agrees on it;
  // since field ids are unioned across schemas, fall back to the observed data range whenever
  // more than one schema could be contributing values for it.
  const definingSchemas = schemas.filter(s => s.fields.some(f => f.id === fieldId));
  if (
    field?.type === 'number' &&
    definingSchemas.length <= 1 &&
    (field.min != null || field.max != null)
  ) {
    const values = entities
      .map(e => getNumericValue(e, fieldId))
      .filter((v): v is number => v != null);
    return {
      min: field.min ?? Math.min(...values, 0),
      max: field.max ?? Math.max(...values, 1)
    };
  }
  const values = entities
    .map(e => getNumericValue(e, fieldId))
    .filter((v): v is number => v != null);
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
};
