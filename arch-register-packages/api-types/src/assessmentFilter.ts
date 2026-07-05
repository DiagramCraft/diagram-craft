import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

export const ASSESSMENT_PRESENCE_FIELD_ID = '_assessment';
export const ASSESSMENT_FIELD_PREFIX = '_assessment:';

export const isAssessmentCondition = (condition: FilterCondition): boolean =>
  condition.fieldId === ASSESSMENT_PRESENCE_FIELD_ID || condition.fieldId.startsWith(ASSESSMENT_FIELD_PREFIX);

export const assessmentFieldIdOf = (condition: FilterCondition): string =>
  condition.fieldId.slice(ASSESSMENT_FIELD_PREFIX.length);

export const splitAssessmentConditions = (
  conditions: FilterCondition[]
): { assessmentConditions: FilterCondition[]; otherConditions: FilterCondition[] } => {
  const assessmentConditions: FilterCondition[] = [];
  const otherConditions: FilterCondition[] = [];
  for (const condition of conditions) {
    (isAssessmentCondition(condition) ? assessmentConditions : otherConditions).push(condition);
  }
  return { assessmentConditions, otherConditions };
};

export const matchesAssessmentConditions = (
  values: Record<string, string | number> | undefined,
  conditions: FilterCondition[],
  fields: AssessmentField[]
): boolean =>
  conditions.every(condition => {
    if (condition.fieldId === ASSESSMENT_PRESENCE_FIELD_ID) {
      const hasResponse = values !== undefined;
      if (condition.op === 'not_empty') return hasResponse;
      if (condition.op === 'empty') return !hasResponse;
      return true;
    }

    const fieldId = assessmentFieldIdOf(condition);
    const field = fields.find(f => f.id === fieldId);
    const value = values?.[fieldId];

    if (field?.type === 'rating') {
      if (typeof value !== 'number') return false;
      if (condition.op === 'gte') return value >= Number(condition.value);
      if (condition.op === 'lte') return value <= Number(condition.value);
      return true;
    }

    if (field?.type === 'enum') {
      if (condition.op === 'empty') return value === undefined;
      if (value === undefined) return false;
      if (condition.op === 'equals') return String(value) === condition.value;
      if (condition.op === 'not_equals') return String(value) !== condition.value;
      return true;
    }

    if (field?.type === 'text') {
      const str = value === undefined ? '' : String(value);
      if (condition.op === 'empty') return str === '';
      if (condition.op === 'not_empty') return str !== '';
      if (condition.op === 'contains') return str.toLowerCase().includes(String(condition.value ?? '').toLowerCase());
      return true;
    }

    return true;
  });
