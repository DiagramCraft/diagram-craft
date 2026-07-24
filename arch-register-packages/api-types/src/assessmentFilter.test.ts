import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_PRESENCE_FIELD_ID,
  isAssessmentCondition,
  isAssessmentFieldId,
  matchesAssessmentConditions,
  resolveAssessmentValue,
  splitAssessmentConditions
} from '@arch-register/api-types/assessmentFilter';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

const fields: AssessmentField[] = [
  { id: 'rating1', label: 'Rating', requirementLevel: 'required', type: 'rating' },
  { id: 'enum1', label: 'Enum', requirementLevel: 'optional', type: 'enum', enumId: 'e1' },
  { id: 'text1', label: 'Text', requirementLevel: 'optional', type: 'text' }
];

describe('isAssessmentCondition / splitAssessmentConditions', () => {
  it('identifies presence and field-prefixed conditions', () => {
    expect(
      isAssessmentCondition({
        fieldId: ASSESSMENT_PRESENCE_FIELD_ID,
        op: 'not_empty',
        value: undefined
      })
    ).toBe(true);
    expect(isAssessmentCondition({ fieldId: '_assessment:rating1', op: 'gte', value: 3 })).toBe(
      true
    );
    expect(isAssessmentCondition({ fieldId: '_schemaId', op: 'equals', value: 'x' })).toBe(false);
  });

  it('splits mixed conditions into assessment vs other', () => {
    const conditions: FilterCondition[] = [
      { fieldId: '_schemaId', op: 'equals', value: 'x' },
      { fieldId: ASSESSMENT_PRESENCE_FIELD_ID, op: 'not_empty', value: undefined },
      { fieldId: '_assessment:enum1', op: 'equals', value: 'a' }
    ];
    const { assessmentConditions, otherConditions } = splitAssessmentConditions(conditions);
    expect(assessmentConditions).toHaveLength(2);
    expect(otherConditions).toHaveLength(1);
  });
});

describe('matchesAssessmentConditions', () => {
  it('treats undefined values as no response for presence checks', () => {
    expect(
      matchesAssessmentConditions(
        undefined,
        [{ fieldId: ASSESSMENT_PRESENCE_FIELD_ID, op: 'not_empty', value: undefined }],
        fields
      )
    ).toBe(false);
    expect(
      matchesAssessmentConditions(
        undefined,
        [{ fieldId: ASSESSMENT_PRESENCE_FIELD_ID, op: 'empty', value: undefined }],
        fields
      )
    ).toBe(true);
  });

  it('matches rating with inclusive gte/lte bounds', () => {
    const conditions: FilterCondition[] = [
      { fieldId: '_assessment:rating1', op: 'gte', value: 3 },
      { fieldId: '_assessment:rating1', op: 'lte', value: 4 }
    ];
    expect(matchesAssessmentConditions({ rating1: 3 }, conditions, fields)).toBe(true);
    expect(matchesAssessmentConditions({ rating1: 4 }, conditions, fields)).toBe(true);
    expect(matchesAssessmentConditions({ rating1: 2 }, conditions, fields)).toBe(false);
    expect(matchesAssessmentConditions({ rating1: 5 }, conditions, fields)).toBe(false);
    expect(matchesAssessmentConditions(undefined, conditions, fields)).toBe(false);
  });

  it('matches enum equals/not_equals/empty', () => {
    expect(
      matchesAssessmentConditions(
        { enum1: 'a' },
        [{ fieldId: '_assessment:enum1', op: 'equals', value: 'a' }],
        fields
      )
    ).toBe(true);
    expect(
      matchesAssessmentConditions(
        { enum1: 'a' },
        [{ fieldId: '_assessment:enum1', op: 'not_equals', value: 'b' }],
        fields
      )
    ).toBe(true);
    expect(
      matchesAssessmentConditions(
        undefined,
        [{ fieldId: '_assessment:enum1', op: 'empty', value: undefined }],
        fields
      )
    ).toBe(true);
    expect(
      matchesAssessmentConditions(
        undefined,
        [{ fieldId: '_assessment:enum1', op: 'equals', value: 'a' }],
        fields
      )
    ).toBe(false);
  });

  it('matches text contains/empty/not_empty', () => {
    expect(
      matchesAssessmentConditions(
        { text1: 'Hello World' },
        [{ fieldId: '_assessment:text1', op: 'contains', value: 'world' }],
        fields
      )
    ).toBe(true);
    expect(
      matchesAssessmentConditions(
        undefined,
        [{ fieldId: '_assessment:text1', op: 'empty', value: undefined }],
        fields
      )
    ).toBe(true);
    expect(
      matchesAssessmentConditions(
        { text1: 'x' },
        [{ fieldId: '_assessment:text1', op: 'not_empty', value: undefined }],
        fields
      )
    ).toBe(true);
  });
});

describe('isAssessmentFieldId', () => {
  it('identifies prefixed field ids', () => {
    expect(isAssessmentFieldId('_assessment:rating1')).toBe(true);
    expect(isAssessmentFieldId('_schemaId')).toBe(false);
    expect(isAssessmentFieldId(ASSESSMENT_PRESENCE_FIELD_ID)).toBe(false);
  });
});

describe('resolveAssessmentValue', () => {
  it('returns null for non-assessment field ids', () => {
    expect(resolveAssessmentValue({ _assessment: { rating1: 3 } }, '_schemaId')).toBeNull();
  });

  it('returns null when the entity has no joined assessment', () => {
    expect(resolveAssessmentValue({}, '_assessment:rating1')).toBeNull();
  });

  it('returns null when the field has no response', () => {
    expect(
      resolveAssessmentValue({ _assessment: { enum1: 'a' } }, '_assessment:rating1')
    ).toBeNull();
  });

  it('returns the raw response value when present', () => {
    expect(resolveAssessmentValue({ _assessment: { rating1: 3 } }, '_assessment:rating1')).toBe(3);
    expect(resolveAssessmentValue({ _assessment: { enum1: 'a' } }, '_assessment:enum1')).toBe('a');
  });
});
