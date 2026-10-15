import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { computeProgress, referenceIds, resolveRelatedEntities } from './relatedEntitiesLogic';

const entity = (uid: string, fields: Record<string, unknown> = {}) =>
  ({ _uid: uid, ...fields }) as unknown as EntityRecord;

describe('referenceIds', () => {
  it('normalizes strings and { id } objects, dropping junk', () => {
    expect(referenceIds(['a', { id: 'b' }, { id: 3 }, '', null])).toEqual(['a', 'b']);
    expect(referenceIds(undefined)).toEqual([]);
  });
});

describe('resolveRelatedEntities', () => {
  const outcomes = [entity('o1', { objectives: ['obj1'] }), entity('o2', { objectives: ['obj2'] })];
  const measures = [
    entity('m1', { outcomes: ['o1'] }),
    entity('m2', { outcomes: ['o2'] }),
    entity('m3', { outcomes: [] })
  ];

  it('resolves a single hop', () => {
    expect(
      resolveRelatedEntities('obj1', [{ entities: outcomes, referenceField: 'objectives' }]).map(
        e => e._uid
      )
    ).toEqual(['o1']);
  });

  it('chains hops and returns the last hop only', () => {
    expect(
      resolveRelatedEntities('obj1', [
        { entities: outcomes, referenceField: 'objectives' },
        { entities: measures, referenceField: 'outcomes' }
      ]).map(e => e._uid)
    ).toEqual(['m1']);
  });

  it('returns nothing when an intermediate hop is empty', () => {
    expect(
      resolveRelatedEntities('none', [
        { entities: outcomes, referenceField: 'objectives' },
        { entities: measures, referenceField: 'outcomes' }
      ])
    ).toEqual([]);
  });
});

describe('computeProgress', () => {
  const fields = {
    baselineField: 'baseline',
    currentField: 'current',
    targetField: 'target',
    unitField: 'unit'
  };

  it('computes position on the span with unit label', () => {
    const progress = computeProgress(
      entity('m', { baseline: 10, current: 30, target: 50, unit: '%' }),
      fields
    );
    expect(progress).toEqual({ percent: 50, label: '30% / 50%' });
  });

  it('clamps, handles descending spans and zero spans', () => {
    expect(
      computeProgress(entity('m', { baseline: 100, current: 40, target: 20 }), fields)?.percent
    ).toBe(75);
    expect(
      computeProgress(entity('m', { baseline: 0, current: 99, target: 10 }), fields)?.percent
    ).toBe(100);
    expect(
      computeProgress(entity('m', { baseline: 5, current: 9, target: 5 }), fields)?.percent
    ).toBe(0);
  });

  it('returns null when a value is missing', () => {
    expect(computeProgress(entity('m', { baseline: 1, target: 2 }), fields)).toBeNull();
  });
});
