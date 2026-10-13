import { describe, expect, it } from 'vitest';
import { barFraction, resolveBandTone, toNumericValue } from './columnRenderers';
import {
  getColumnRenderer,
  getEntityDisplayRawValue,
  withColumnRenderers,
  type EntityDisplayField
} from './entityDisplayFields';
import type { EntityRecord } from '@arch-register/api-types/entityContract';

const numberField: EntityDisplayField = { id: 'spend', label: 'Spend', group: 'g' };
const dateField = {
  id: 'due',
  label: 'Due',
  group: 'g',
  schemaField: { type: 'date' }
} as unknown as EntityDisplayField;

describe('barFraction', () => {
  it('clamps to the range', () => {
    expect(barFraction(50)).toBe(0.5);
    expect(barFraction(150)).toBe(1);
    expect(barFraction(-5)).toBe(0);
    expect(barFraction(5, 0, 10)).toBe(0.5);
    expect(barFraction(5, 10, 10)).toBe(0);
  });
});

describe('resolveBandTone', () => {
  const bands = [
    { max: 10, tone: 'good' as const },
    { max: null, tone: 'bad' as const }
  ];
  it('maps numbers to bands', () => {
    expect(resolveBandTone({ value: 5, field: numberField }, { type: 'colorBand', bands })).toBe(
      'good'
    );
    expect(resolveBandTone({ value: 50, field: numberField }, { type: 'colorBand', bands })).toBe(
      'bad'
    );
  });
  it('maps option values', () => {
    const config = { type: 'colorBand' as const, options: { high: 'bad' as const } };
    expect(resolveBandTone({ value: 'high', field: numberField }, config)).toBe('bad');
    expect(resolveBandTone({ value: 'other', field: numberField }, config)).toBeNull();
  });
  it('returns null for missing values', () => {
    expect(
      resolveBandTone({ value: null, field: numberField }, { type: 'colorBand', bands })
    ).toBeNull();
  });
  it('maps dates to days from now', () => {
    const now = Date.parse('2026-01-10');
    expect(toNumericValue('2026-01-15', dateField, now)).toBe(5);
    expect(toNumericValue('2026-01-05', dateField, now)).toBe(-5);
    expect(toNumericValue('abc', numberField)).toBeNull();
  });
});

describe('column renderer config helpers', () => {
  it('defaults to plain when absent', () => {
    expect(getColumnRenderer(undefined, 'a')).toEqual({ type: 'plain' });
    expect(getColumnRenderer({ fieldIds: ['a'] }, 'a')).toEqual({ type: 'plain' });
  });
  it('sets and removes the map while keeping other keys', () => {
    const withMap = withColumnRenderers({ fieldIds: ['a'] }, { a: { type: 'bar' } });
    expect(withMap).toEqual({ fieldIds: ['a'], columnRenderers: { a: { type: 'bar' } } });
    expect(withColumnRenderers(withMap, {})).toEqual({ fieldIds: ['a'] });
  });
  it('reads raw values including projections', () => {
    const entity = {
      _projections: { x: 7 },
      spend: [3, 4],
      _completeness: 80
    } as unknown as EntityRecord;
    expect(getEntityDisplayRawValue(entity, { id: '_projection:x', label: 'x', group: 'p' })).toBe(
      7
    );
    expect(getEntityDisplayRawValue(entity, numberField)).toBe(3);
    expect(getEntityDisplayRawValue(entity, { id: '_completeness', label: 'c', group: 'g' })).toBe(
      80
    );
  });
});
