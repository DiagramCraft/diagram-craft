import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { BlastRadiusEntity } from '../../../lib/blastRadiusFilters';
import { buildBlastRadiusGroupPaths, buildBlastRadiusGroups } from './blastRadiusGroups';

const entity = (id: string, depth: number, pathId: string): BlastRadiusEntity =>
  ({
    entityId: id,
    depth,
    paths: [{ pathId, depth }]
  }) as unknown as BlastRadiusEntity;

const schema = {
  fields: [
    {
      id: 'providers',
      name: 'Providers',
      type: 'typedRelation',
      relationSchemaId: 'rel-p'
    },
    {
      id: 'consumers',
      name: 'Consumers',
      type: 'typedRelation',
      relationSchemaId: 'rel-c'
    },
    { id: 'plain', name: 'Plain', type: 'text' }
  ]
} as unknown as EntitySchema;

const groups = [
  { fieldName: 'providers', label: 'Providers' },
  { fieldName: 'Consumers', label: 'Direct consumers' }
];

describe('buildBlastRadiusGroupPaths', () => {
  it('resolves fields by id or name and omits unresolved ones', () => {
    expect(buildBlastRadiusGroupPaths(schema, groups).map(path => path.id)).toEqual([
      'group-0',
      'group-1'
    ]);
    expect(buildBlastRadiusGroupPaths(schema, [{ fieldName: 'plain', label: 'Plain' }])).toEqual(
      []
    );
    expect(buildBlastRadiusGroupPaths(undefined, groups)).toEqual([]);
  });
});

describe('buildBlastRadiusGroups', () => {
  it('splits direct groups and second order', () => {
    const entities = [
      entity('provider', 1, 'group-0'),
      entity('consumer', 1, 'group-1'),
      entity('far', 2, 'group-1')
    ];
    const [providers, consumers, secondOrder] = buildBlastRadiusGroups(groups).map(group =>
      group.select(entities).map(e => e.entityId)
    );
    expect(providers).toEqual(['provider']);
    expect(consumers).toEqual(['consumer']);
    expect(secondOrder).toEqual(['far']);
  });
});
