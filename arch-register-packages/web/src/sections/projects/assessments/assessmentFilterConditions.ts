import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';

export type AssessmentFilterCondition =
  | { fieldId: string; kind: 'rating'; min?: number; max?: number }
  | { fieldId: string; kind: 'enum'; op: 'equals' | 'not_equals' | 'empty'; value?: string }
  | { fieldId: string; kind: 'text'; op: 'contains' | 'empty' | 'not_empty'; value?: string }
  | { fieldId: '_owner'; kind: 'owner'; value?: string }
  | { fieldId: '_schema'; kind: 'schemaType'; value?: string };

const conditionKindForField = (
  fieldId: string,
  fields: AssessmentField[]
): AssessmentFilterCondition['kind'] => {
  if (fieldId === '_owner') return 'owner';
  if (fieldId === '_schema') return 'schemaType';
  const field = fields.find(f => f.id === fieldId);
  if (field?.type === 'derived') {
    return field.resultType === 'select'
      ? 'enum'
      : field.resultType === 'rating'
        ? 'rating'
        : 'text';
  }
  return field?.type ?? 'text';
};

export const defaultConditionFor = (
  fieldId: string,
  fields: AssessmentField[]
): AssessmentFilterCondition => {
  const kind = conditionKindForField(fieldId, fields);
  if (kind === 'rating') return { fieldId, kind: 'rating' };
  if (kind === 'enum') return { fieldId, kind: 'enum', op: 'equals', value: '' };
  if (kind === 'owner') return { fieldId: '_owner', kind: 'owner', value: '' };
  if (kind === 'schemaType') return { fieldId: '_schema', kind: 'schemaType', value: '' };
  return { fieldId, kind: 'text', op: 'contains', value: '' };
};

export const matchesAssessmentFilterConditions = (
  entity: EntitySummary,
  values: Record<string, string | number | boolean>,
  conditions: AssessmentFilterCondition[]
): boolean =>
  conditions.every(condition => {
    if (condition.kind === 'rating') {
      const value = values[condition.fieldId];
      if (typeof value !== 'number') return false;
      if (condition.min !== undefined && value < condition.min) return false;
      if (condition.max !== undefined && value > condition.max) return false;
      return true;
    }
    if (condition.kind === 'enum') {
      const value = values[condition.fieldId];
      if (condition.op === 'empty') return value === undefined;
      if (value === undefined) return false;
      if (condition.op === 'equals') return String(value) === condition.value;
      return String(value) !== condition.value;
    }
    if (condition.kind === 'text') {
      const value = values[condition.fieldId];
      const str = value === undefined ? '' : String(value);
      if (condition.op === 'empty') return str === '';
      if (condition.op === 'not_empty') return str !== '';
      return str.toLowerCase().includes((condition.value ?? '').toLowerCase());
    }
    if (condition.kind === 'owner') {
      if (!condition.value) return true;
      return entity._owner?.id === condition.value;
    }
    if (condition.kind === 'schemaType') {
      if (!condition.value) return true;
      return entity._schema.id === condition.value;
    }
    return true;
  });
