import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import {
  buildContainmentTreeIndex,
  getChildSchemas,
  getContainmentChildren,
  getMapTraversalPath,
  getMapSchemaIds,
  sortContainmentNodes
} from './mapViewState';

const schema = (id: string, parentSchemaId?: string) =>
  ({
    id,
    name: id,
    fields: parentSchemaId
      ? [{ id: 'parent', name: 'Parent', type: 'containment', schemaId: parentSchemaId }]
      : []
  }) as unknown as EntitySchema;

const node = (id: string, schemaId: string, name: string, isMatch = true) =>
  ({
    _uid: id,
    _name: name,
    _slug: id,
    _schema: { id: schemaId, name: schemaId },
    _isMatch: isMatch
  }) as unknown as TreeNode;

describe('map view state', () => {
  it('finds schemas whose containment points to the selected parent', () => {
    expect(
      getChildSchemas(
        [schema('service'), schema('app', 'service'), schema('team', 'other')],
        'service'
      ).map(item => item.id)
    ).toEqual(['app']);
    expect(getChildSchemas([schema('service')], null).map(item => item.id)).toEqual(['service']);
  });

  it('includes typed-relation target schemas as map children', () => {
    const system = {
      ...schema('system'),
      fields: [
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'out'
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(getChildSchemas([system, contract], 'system', [relationSchema])).toEqual([contract]);
  });

  it('builds the Domain → System → Contract traversal automatically', () => {
    const domain = schema('domain');
    const system = {
      ...schema('system', 'domain'),
      fields: [
        { id: 'domain', name: 'Domain', type: 'containment', schemaId: 'domain' },
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'out'
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(
      getMapTraversalPath(
        ['domain', 'system', 'contract'],
        [domain, system, contract],
        [relationSchema]
      )
    ).toEqual([
      { kind: 'relation', fieldId: 'domain', direction: 'backward', ownerSchemaId: 'system' },
      {
        kind: 'typedRelation',
        fieldId: 'contracts',
        relationSchemaId: 'system-contract',
        direction: 'out'
      }
    ]);
  });

  it('indexes edges and sorts only matching children', () => {
    const nodes = [
      node('b', 'app', 'Beta'),
      node('a', 'app', 'Alpha'),
      node('hidden', 'app', 'Hidden', false),
      node('other', 'team', 'Other')
    ];
    const edges = [
      { parentId: 'root', childId: 'b' },
      { parentId: 'root', childId: 'a' },
      { parentId: 'root', childId: 'hidden' },
      { parentId: 'root', childId: 'other' }
    ] as unknown as TreeEdge[];
    const index = buildContainmentTreeIndex(nodes, edges);
    expect(sortContainmentNodes(nodes, 'app').map(item => item._uid)).toEqual(['a', 'b']);
    expect(getContainmentChildren('root', 'app', index).map(item => item._uid)).toEqual(['a', 'b']);
  });

  it('collects the schema ids for the configured map levels', () => {
    expect(
      getMapSchemaIds({
        levels: 3,
        level1SchemaId: 'domain',
        level2SchemaId: 'system',
        level3SchemaId: 'component'
      })
    ).toEqual(['domain', 'system', 'component']);
  });

  it('truncates to the number of active levels', () => {
    expect(
      getMapSchemaIds({
        levels: 1,
        level1SchemaId: 'domain',
        level2SchemaId: 'system',
        level3SchemaId: 'component'
      })
    ).toEqual(['domain']);
  });

  it('filters out unset levels and dedupes repeated schema ids', () => {
    expect(
      getMapSchemaIds({
        levels: 3,
        level1SchemaId: 'domain',
        level2SchemaId: null,
        level3SchemaId: 'domain'
      })
    ).toEqual(['domain']);
  });

  it('returns an empty list when the map is unconfigured', () => {
    expect(
      getMapSchemaIds({
        levels: 2,
        level1SchemaId: null,
        level2SchemaId: null,
        level3SchemaId: null
      })
    ).toEqual([]);
  });
});
