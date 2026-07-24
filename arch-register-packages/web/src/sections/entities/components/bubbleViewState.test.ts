import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  buildBubbles,
  formatNumber,
  positionOnBubbleAxis,
  type BubbleConfig
} from './bubbleViewState';

const entity = (id: string, x: number, y: number) =>
  ({
    _uid: id,
    _name: id,
    _slug: id,
    _schema: { id: 'service', name: 'Service' },
    x,
    y,
    _lifecycle: null,
    _owner: null
  }) as unknown as EntityRecord;

const config: BubbleConfig = {
  xFieldId: 'x',
  yFieldId: 'y',
  sizeFieldId: null,
  colorFieldId: null
};

describe('bubble view state', () => {
  it('formats integer and fractional numeric values', () => {
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(2.125)).toBe('2.13');
  });

  it('maps numeric values to clamped axis positions', () => {
    expect(
      positionOnBubbleAxis(entity('middle', 5, 0), 'x', { min: 0, max: 10 }, null, 0, 100, false)
    ).toBe(50);
    expect(
      positionOnBubbleAxis(entity('outside', 20, 0), 'x', { min: 0, max: 10 }, null, 0, 100, false)
    ).toBe(100);
    expect(
      positionOnBubbleAxis(
        entity('missing', 0, 0),
        'missing',
        { min: 0, max: 10 },
        null,
        0,
        100,
        false
      )
    ).toBeNull();
  });

  it('builds bubbles and deterministic overlap clusters', () => {
    const result = buildBubbles({
      entities: [entity('a', 5, 5), entity('b', 5, 5)],
      config,
      xRange: { min: 0, max: 10 },
      yRange: { min: 0, max: 10 },
      sizeRange: null,
      xCategories: null,
      yCategories: null,
      colorCategories: [],
      colorMap: new Map()
    });

    expect(result.bubbles).toHaveLength(2);
    expect(result.bubbles.every(bubble => bubble.clusterCount === 2)).toBe(true);
    expect(result.clusterBadges).toHaveLength(1);
    expect(result.clusterBadges[0]).toMatchObject({ cx: 444, count: 2 });
    expect(result.clusterBadges[0]!.cy).toBeCloseTo(240.34, 2);
  });
});
