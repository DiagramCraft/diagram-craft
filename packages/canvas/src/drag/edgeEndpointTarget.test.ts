import { describe, expect, test } from 'vitest';
import { resolveEdgeEndpointTarget } from './edgeEndpointTarget';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('edgeEndpointTarget', () => {
  test('prefers the deepest child node under the pointer', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const parent = layer.addNode({
      id: 'parent',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 300, h: 300, r: 0 }
    });
    const child = layer.createNode({
      id: 'child',
      type: 'rect',
      bounds: { x: 50, y: 50, w: 200, h: 200, r: 0 }
    });
    const grandchild = layer.createNode({
      id: 'grandchild',
      type: 'rect',
      bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      parent.addChild(child, uow);
      child.addChild(grandchild, uow);
    });

    expect(resolveEdgeEndpointTarget(parent, { x: 110, y: 110 })).toBe(grandchild);
    expect(resolveEdgeEndpointTarget(parent, { x: 70, y: 70 })).toBe(child);
    expect(resolveEdgeEndpointTarget(parent, { x: 10, y: 10 })).toBe(parent);
  });
});
