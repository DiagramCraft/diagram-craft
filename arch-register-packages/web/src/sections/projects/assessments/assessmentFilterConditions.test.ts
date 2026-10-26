import { describe, expect, it } from 'vitest';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import {
  defaultConditionFor,
  matchesAssessmentFilterConditions,
  type AssessmentFilterCondition
} from './assessmentFilterConditions';

const entity = {
  _uid: 'e1',
  _owner: { id: 't1', name: 'Team' },
  _schema: { id: 's1', name: 'Service' }
} as unknown as EntitySummary;

const matches = (
  values: Record<string, string | number | boolean>,
  ...conditions: AssessmentFilterCondition[]
) => matchesAssessmentFilterConditions(entity, values, conditions);

describe('matchesAssessmentFilterConditions', () => {
  it('matches rating ranges and rejects missing ratings', () => {
    const range: AssessmentFilterCondition = { fieldId: 'r', kind: 'rating', min: 2, max: 4 };
    expect(matches({ r: 3 }, range)).toBe(true);
    expect(matches({ r: 5 }, range)).toBe(false);
    expect(matches({ r: 1 }, range)).toBe(false);
    expect(matches({}, range)).toBe(false);
  });

  it('matches enum equality and emptiness', () => {
    const equals: AssessmentFilterCondition = {
      fieldId: 'e',
      kind: 'enum',
      op: 'equals',
      value: 'a'
    };
    const empty: AssessmentFilterCondition = { fieldId: 'e', kind: 'enum', op: 'empty' };
    expect(matches({ e: 'a' }, equals)).toBe(true);
    expect(matches({ e: 'b' }, equals)).toBe(false);
    expect(matches({}, equals)).toBe(false);
    expect(matches({}, empty)).toBe(true);
    expect(matches({ e: 'a' }, empty)).toBe(false);
  });

  it('matches text case-insensitively', () => {
    const contains: AssessmentFilterCondition = {
      fieldId: 't',
      kind: 'text',
      op: 'contains',
      value: 'HELLO'
    };
    expect(matches({ t: 'say hello there' }, contains)).toBe(true);
    expect(matches({ t: 'goodbye' }, contains)).toBe(false);
    expect(matches({}, { fieldId: 't', kind: 'text', op: 'empty' })).toBe(true);
    expect(matches({ t: 'x' }, { fieldId: 't', kind: 'text', op: 'not_empty' })).toBe(true);
  });

  it('matches owner and schema, and ignores unset values', () => {
    expect(matches({}, { fieldId: '_owner', kind: 'owner', value: 't1' })).toBe(true);
    expect(matches({}, { fieldId: '_owner', kind: 'owner', value: 't2' })).toBe(false);
    expect(matches({}, { fieldId: '_owner', kind: 'owner', value: '' })).toBe(true);
    expect(matches({}, { fieldId: '_schema', kind: 'schemaType', value: 's1' })).toBe(true);
    expect(matches({}, { fieldId: '_schema', kind: 'schemaType', value: 's2' })).toBe(false);
  });

  it('requires every condition to match', () => {
    expect(
      matches(
        { r: 3 },
        { fieldId: 'r', kind: 'rating', min: 2 },
        { fieldId: '_owner', kind: 'owner', value: 't2' }
      )
    ).toBe(false);
  });
});

describe('defaultConditionFor', () => {
  const fields = [
    { id: 'r', type: 'rating', label: 'R' },
    { id: 'e', type: 'enum', label: 'E' },
    { id: 'd', type: 'derived', resultType: 'select', label: 'D' },
    { id: 't', type: 'text', label: 'T' }
  ] as unknown as AssessmentField[];

  it('picks the condition kind from the field type', () => {
    expect(defaultConditionFor('_owner', fields).kind).toBe('owner');
    expect(defaultConditionFor('_schema', fields).kind).toBe('schemaType');
    expect(defaultConditionFor('r', fields).kind).toBe('rating');
    expect(defaultConditionFor('e', fields).kind).toBe('enum');
    expect(defaultConditionFor('d', fields).kind).toBe('enum');
    expect(defaultConditionFor('t', fields).kind).toBe('text');
  });
});
