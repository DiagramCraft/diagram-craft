import { describe, expect, it } from 'vitest';
import { connectorDistance, cubicPoint, pointToSegmentDistance, type ExploreConnectorLine } from './exploreGeometry';

const line = { fromColumn: 0, fromEntityId: 'a', fromEntityName: 'A', toColumn: 1, toEntityId: 'b', toEntityName: 'B', fieldName: 'uses', fieldLabel: 'Uses', kind: 'reference', x1: 0, y1: 0, x2: 100, y2: 100 } as ExploreConnectorLine;

describe('explore connector geometry', () => {
  it('handles points and degenerate segments', () => {
    expect(pointToSegmentDistance(5, 5, 0, 0, 10, 0)).toBe(5);
    expect(pointToSegmentDistance(3, 4, 0, 0, 0, 0)).toBe(5);
  });

  it('evaluates cubic curves and finds nearby connector distance', () => {
    expect(cubicPoint(0, 0, 0, 0, 0, 10, 10, 10, 10)).toEqual({ x: 0, y: 0 });
    expect(cubicPoint(1, 0, 0, 0, 0, 10, 10, 10, 10)).toEqual({ x: 10, y: 10 });
    expect(connectorDistance(line, 50, 50)).toBeLessThan(2);
    expect(connectorDistance(line, 50, 0)).toBeGreaterThan(20);
  });
});
