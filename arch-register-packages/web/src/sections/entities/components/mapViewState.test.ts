import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import {
  buildContainmentTreeIndex,
  getChildSchemas,
  getContainmentChildren,
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
});
