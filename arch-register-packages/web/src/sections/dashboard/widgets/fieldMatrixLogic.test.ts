import { describe, expect, it } from 'vitest';
import { bandIndexFor, buildFieldMatrixCells, type FieldMatrixBand } from './fieldMatrixLogic';

const bands: FieldMatrixBand[] = [
  { label: 'Low', min: 0, tone: 'good' },
  { label: 'Moderate', min: 2, tone: 'neutral' },
  { label: 'Elevated', min: 2.7, tone: 'warn', hot: true },
  { label: 'High', min: 3.4, tone: 'bad', hot: true }
];

const rec = (id: string, criticality: unknown, risk: unknown) => ({
  _publicId: id,
  _name: id.toUpperCase(),
  criticality,
  risk
});

describe('bandIndexFor', () => {
  it('uses the last band whose min is met', () => {
    expect(bandIndexFor(1.9, bands)).toBe(0);
    expect(bandIndexFor(2, bands)).toBe(1);
    expect(bandIndexFor(3.4, bands)).toBe(3);
  });

  it('returns null for non-numbers and values below every band', () => {
    expect(bandIndexFor(undefined, bands)).toBeNull();
    expect(bandIndexFor(NaN, bands)).toBeNull();
    expect(bandIndexFor(-1, bands)).toBeNull();
  });
});

describe('buildFieldMatrixCells', () => {
  it('buckets records by row value and band, skipping unlisted rows and missing values', () => {
    const cells = buildFieldMatrixCells(
      [
        rec('a', 5, 3.5),
        rec('b', 5, 3.9),
        rec('c', 3, 1),
        rec('d', 1, 3),
        rec('e', 4, undefined),
        rec('f', undefined, 3)
      ],
      { rowFieldId: 'criticality', valueFieldId: 'risk', rows: [5, 4, 3, 2], bands }
    );
    expect(cells.get('5:3')?.map(item => item.id)).toEqual(['a', 'b']);
    expect(cells.get('3:0')?.map(item => item.id)).toEqual(['c']);
    expect(cells.size).toBe(2);
  });
});
