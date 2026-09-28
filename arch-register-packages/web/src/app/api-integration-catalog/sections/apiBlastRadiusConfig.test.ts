import { describe, expect, it } from 'vitest';
import type { BlastRadiusEntity } from '../../../lib/blastRadiusFilters';
import {
  API_BLAST_RADIUS_GROUPS,
  buildApiBlastRadiusPaths,
  CONSUMES_PATH_ID,
  PROVIDES_PATH_ID
} from './apiBlastRadiusConfig';

const entity = (id: string, depth: number, pathId: string): BlastRadiusEntity =>
  ({ entityId: id, depth, paths: [{ pathId, depth }] }) as unknown as BlastRadiusEntity;

describe('buildApiBlastRadiusPaths', () => {
  it('omits paths for unconfigured relation schemas', () => {
    expect(buildApiBlastRadiusPaths(null, null)).toEqual([]);
    expect(buildApiBlastRadiusPaths('p', null).map(path => path.id)).toEqual([PROVIDES_PATH_ID]);
    expect(buildApiBlastRadiusPaths('p', 'c').map(path => path.id)).toEqual([
      PROVIDES_PATH_ID,
      CONSUMES_PATH_ID
    ]);
  });
});

describe('API_BLAST_RADIUS_GROUPS', () => {
  it('splits providers, direct consumers and second order', () => {
    const entities = [
      entity('provider', 1, PROVIDES_PATH_ID),
      entity('consumer', 1, CONSUMES_PATH_ID),
      entity('far', 2, CONSUMES_PATH_ID)
    ];
    const [providers, consumers, secondOrder] = API_BLAST_RADIUS_GROUPS.map(group =>
      group.select(entities).map(e => e.entityId)
    );
    expect(providers).toEqual(['provider']);
    expect(consumers).toEqual(['consumer']);
    expect(secondOrder).toEqual(['far']);
  });
});
