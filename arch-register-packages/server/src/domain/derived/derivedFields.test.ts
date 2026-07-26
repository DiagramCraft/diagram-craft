import { describe, expect, it } from 'vitest';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import { buildDerivedPlan, evaluateDerivedFields, materializeDerivedFields } from './derivedFields';

const field = (id: string, type: AssessmentField['type'] = 'text'): AssessmentField => {
  if (type === 'derived') {
    return {
      id,
      label: id,
      type,
      requirementLevel: 'optional',
      expression: 'field("input")',
      resultType: 'text'
    };
  }
  return { id, label: id, type, requirementLevel: 'optional' } as AssessmentField;
};

const context = { objectType: 'assessment' as const, objectId: 'assessment-1' };

describe('derived fields', () => {
  it('evaluates sibling references in dependency order and materializes typed values', () => {
    const fields: AssessmentField[] = [
      field('input'),
      {
        id: 'amount',
        label: 'Amount',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'field("input") + 2',
        resultType: 'number'
      },
      {
        id: 'summary',
        label: 'Summary',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'field("amount") + 3',
        resultType: 'number'
      }
    ];

    expect(materializeDerivedFields(fields, { input: 5 }, context)).toEqual({
      input: 5,
      amount: 7,
      summary: 10
    });
  });

  it('omits derived values when an input is missing or the result has the wrong type', () => {
    const fields: AssessmentField[] = [
      field('input'),
      {
        id: 'derived',
        label: 'Derived',
        type: 'derived',
        requirementLevel: 'optional',
        expression: 'field("input")',
        resultType: 'number'
      }
    ];
    const plan = buildDerivedPlan(fields);

    expect(evaluateDerivedFields(plan, { input: '' }, context)).toEqual({ input: '' });
    expect(evaluateDerivedFields(plan, { input: 'not a number' }, context)).toEqual({
      input: 'not a number'
    });
  });

  it('rejects unknown references and cycles', () => {
    expect(() =>
      buildDerivedPlan([
        field('input'),
        {
          id: 'derived',
          label: 'Derived',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'field("missing")',
          resultType: 'text'
        }
      ])
    ).toThrow(/unknown sibling field/);

    const cyclic = [
      {
        id: 'first',
        label: 'First',
        type: 'derived' as const,
        requirementLevel: 'optional' as const,
        expression: 'field("second")',
        resultType: 'text' as const
      },
      {
        id: 'second',
        label: 'Second',
        type: 'derived' as const,
        requirementLevel: 'optional' as const,
        expression: 'field("first")',
        resultType: 'text' as const
      }
    ];
    expect(() => buildDerivedPlan(cyclic)).toThrow(/Cyclic derived field dependency/);
  });
});
