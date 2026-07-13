import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { buildBlips, buildQuadrants, buildRings, getBlipXY, MAX_R } from './radarViewState';

const values = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ value: `${prefix}-${index}`, label: `${prefix} ${index}` }));

const entity = (id: string, quadrant: string, ring: string, name = id) =>
  ({
    _uid: id,
    _name: name,
    _slug: id,
    _schema: { id: 'service', name: 'Service' },
    _lifecycle: null,
    _owner: null,
    [quadrant]: 'q-0',
    [ring]: 'r-0'
  }) as unknown as EntityRecord;

describe('radar geometry', () => {
  it('caps quadrants and rings at their supported limits', () => {
    expect(buildQuadrants(values('q', 10))).toHaveLength(8);
    expect(buildRings(values('r', 10))).toHaveLength(5);
    expect(buildRings(values('r', 2))[1]!.outerR).toBe(MAX_R);
  });

  it('places the same blip deterministically inside its quadrant and ring', () => {
    const quadrant = buildQuadrants(values('q', 1))[0]!;
    const ring = buildRings(values('r', 1))[0]!;
    expect(getBlipXY('entity-1', quadrant, ring)).toEqual(getBlipXY('entity-1', quadrant, ring));
  });

  it('filters invalid entities and sorts valid blips by quadrant, ring, and name', () => {
    const quadrants = buildQuadrants([{ value: 'q-0', label: 'Q0' }]);
    const rings = buildRings([{ value: 'r-0', label: 'R0' }]);
    const entities = [entity('b', 'quadrant', 'ring', 'Beta'), entity('a', 'quadrant', 'ring', 'Alpha')];

    expect(buildBlips(entities, 'quadrant', 'ring', quadrants, rings).map(blip => blip.id)).toEqual([
      'a',
      'b'
    ]);
    expect(
      buildBlips([{ ...entities[0], quadrant: 'unknown' } as EntityRecord], 'quadrant', 'ring', quadrants, rings)
    ).toEqual([]);
  });
});
