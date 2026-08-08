import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  buildAxisBuckets,
  buildHeatmapCells,
  bucketIndexForEntity,
  severityColorForCell,
  severityColorForValue,
  type HeatmapConfig
} from './heatmapViewState';

const entity = (id: string, likelihood: unknown, impact: unknown, score?: number) =>
  ({
    _uid: id,
    _name: id,
    _slug: id,
    _schema: { id: 'risk', name: 'Risk' },
    likelihood,
    impact,
    score,
    _lifecycle: null,
    _owner: null
  }) as unknown as EntityRecord;

const numericConfig: HeatmapConfig = {
  likelihoodFieldId: 'likelihood',
  impactFieldId: 'impact',
  buckets: 5,
  colorFieldId: null
};

describe('heatmap view state', () => {
  it('builds equal-width numeric bands', () => {
    const buckets = buildAxisBuckets(null, { min: 0, max: 10 }, 5);
    expect(buckets).toHaveLength(5);
    expect(buckets[0]!.label).toBe('0–2');
    expect(buckets[4]!.label).toBe('8–10');
  });

  it('uses declared options in order for a select axis', () => {
    const categories = [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' }
    ];
    expect(buildAxisBuckets(categories, null, 5)).toEqual(categories);
  });

  it('maps numeric values to clamped band indices', () => {
    expect(
      bucketIndexForEntity(entity('a', 5, 5), 'likelihood', null, { min: 0, max: 10 }, 5)
    ).toBe(2);
    expect(
      bucketIndexForEntity(entity('b', 20, 5), 'likelihood', null, { min: 0, max: 10 }, 5)
    ).toBe(4);
    expect(
      bucketIndexForEntity(entity('c', 0, 5), 'likelihood', null, { min: 0, max: 10 }, 5)
    ).toBe(0);
    expect(
      bucketIndexForEntity(
        entity('missing', undefined, 5),
        'likelihood',
        null,
        { min: 0, max: 10 },
        5
      )
    ).toBeNull();
  });

  it('maps categorical values to their declared option index', () => {
    const categories = [
      { id: 'low', label: 'Low' },
      { id: 'high', label: 'High' }
    ];
    expect(bucketIndexForEntity(entity('a', 'high', 5), 'likelihood', categories, null, 2)).toBe(1);
    expect(
      bucketIndexForEntity(entity('b', 'unknown-option', 5), 'likelihood', categories, null, 2)
    ).toBeNull();
  });

  it('aggregates entities into a dense grid and counts unmapped entities', () => {
    const likelihoodBuckets = buildAxisBuckets(null, { min: 0, max: 10 }, 2);
    const impactBuckets = buildAxisBuckets(null, { min: 0, max: 10 }, 2);

    const { cells, unmappedCount } = buildHeatmapCells({
      entities: [
        entity('a', 1, 1),
        entity('b', 1, 1),
        entity('c', 9, 9),
        entity('d', undefined, 5)
      ],
      config: numericConfig,
      likelihoodBuckets,
      impactBuckets,
      likelihoodCategories: null,
      impactCategories: null,
      likelihoodRange: { min: 0, max: 10 },
      impactRange: { min: 0, max: 10 }
    });

    expect(cells).toHaveLength(2);
    expect(cells[0]![0]!.count).toBe(2);
    expect(cells[0]![0]!.entityIds).toEqual(['a', 'b']);
    expect(cells[1]![1]!.count).toBe(1);
    expect(cells[0]![1]!.count).toBe(0);
    expect(unmappedCount).toBe(1);
  });

  it('averages an optional colour field per cell', () => {
    const likelihoodBuckets = buildAxisBuckets(null, { min: 0, max: 10 }, 1);
    const impactBuckets = buildAxisBuckets(null, { min: 0, max: 10 }, 1);

    const { cells } = buildHeatmapCells({
      entities: [entity('a', 5, 5, 10), entity('b', 5, 5, 20)],
      config: { ...numericConfig, colorFieldId: 'score' },
      likelihoodBuckets,
      impactBuckets,
      likelihoodCategories: null,
      impactCategories: null,
      likelihoodRange: { min: 0, max: 10 },
      impactRange: { min: 0, max: 10 }
    });

    expect(cells[0]![0]!.colorValue).toBe(15);
  });

  it('colours low-position cells distinctly from high-position cells', () => {
    const low = severityColorForCell(0, 0, 5, 5);
    const high = severityColorForCell(4, 4, 5, 5);
    expect(low).not.toBe(high);
    expect(low.toLowerCase()).toBe('#0ca30c');
    expect(high.toLowerCase()).toBe('#d03b3b');
  });

  it('colours by normalized value when a colour field is used', () => {
    expect(severityColorForValue(0, 0, 10).toLowerCase()).toBe('#0ca30c');
    expect(severityColorForValue(10, 0, 10).toLowerCase()).toBe('#d03b3b');
  });
});
