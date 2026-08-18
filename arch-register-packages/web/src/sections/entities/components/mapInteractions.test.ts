import { describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import { getMapBoxHandlers, getMapDetailClick } from './mapInteractions';
import {
  buildMapChildren,
  buildRelationMapChildren,
  getMapEntityId,
  makeRelationMapNode
} from './mapViewTraversal';
import { buildContainmentTreeIndex } from './mapViewState';

const entityNode = {
  _uid: 'entity-uid',
  _publicId: 'entity-public-id',
  _name: 'Entity',
  _slug: 'entity',
  _schema: { id: 'service', name: 'Service' },
  _isMatch: true
} as unknown as TreeNode;

describe('map interactions', () => {
  it('navigates to the endpoint behind relation map nodes', () => {
    const relationNode = makeRelationMapNode(
      {
        kind: 'typed',
        relationId: 'relation-1',
        relationSchemaId: 'service-team',
        entityId: 'team-1',
        entitySchemaId: 'team',
        entityName: 'Platform',
        fieldName: 'owner',
        relationFields: {}
      } as never,
      { id: 'service-team', name: 'Service Team' } as never
    );

    expect(getMapEntityId(entityNode)).toBe('entity-public-id');
    expect(getMapEntityId(relationNode)).toBe('team-1');
  });

  it('activates map boxes on click and keyboard input', () => {
    const onEntityClick = vi.fn();
    const handlers = getMapBoxHandlers(entityNode, onEntityClick);
    const preventDefault = vi.fn();

    handlers.onClick();
    handlers.onKeyDown({ key: 'Enter', preventDefault } as never);
    handlers.onKeyDown({ key: ' ', preventDefault } as never);
    handlers.onKeyDown({ key: 'Escape', preventDefault } as never);

    expect(onEntityClick).toHaveBeenNthCalledWith(1, 'entity-public-id');
    expect(onEntityClick).toHaveBeenNthCalledWith(2, 'entity-public-id');
    expect(onEntityClick).toHaveBeenNthCalledWith(3, 'entity-public-id');
    expect(onEntityClick).toHaveBeenCalledTimes(3);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('stops nested detail-link clicks from bubbling to the box', () => {
    const onEntityClick = vi.fn();
    const stopPropagation = vi.fn();

    getMapDetailClick('entity-public-id', onEntityClick)({ stopPropagation } as never);

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onEntityClick).toHaveBeenCalledWith('entity-public-id');
  });

  it('deduplicates and sorts relation and containment children', () => {
    const child = {
      ...entityNode,
      _uid: 'team-1',
      _publicId: 'team-public-id',
      _schema: { id: 'team', name: 'Team' },
      _name: 'Platform',
      _isMatch: false
    } as unknown as TreeNode;
    const treeIndex = buildContainmentTreeIndex([entityNode, child], [
      { parentId: entityNode._uid, childId: child._uid }
    ] as never);
    const relation = {
      kind: 'typed',
      relationId: 'relation-1',
      relationSchemaId: 'service-team',
      entityId: child._uid,
      entitySchemaId: 'team',
      entityName: 'Platform',
      fieldName: 'owner',
      relationFields: {}
    };
    const relationSchemas = [{ id: 'service-team', name: 'Service Team' }] as never;
    const relationData = new Map([
      [
        entityNode._uid,
        {
          outgoing: [relation, { ...relation, relationId: 'relation-2', entityName: 'A Team' }],
          incoming: [relation],
          isLoading: false
        }
      ]
    ]) as never;

    const relationChildren = buildRelationMapChildren(
      entityNode._uid,
      'service-team',
      relationSchemas,
      relationData,
      treeIndex
    );
    expect(relationChildren.map(childNode => childNode._name)).toEqual([
      'owner: A Team',
      'owner: Platform'
    ]);
    expect(
      buildMapChildren(entityNode._uid, 'team', treeIndex, relationData).map(
        childNode => childNode._uid
      )
    ).toEqual(['team-1']);
  });
});
