import { describe, expect, test } from 'vitest';
import { Box } from '@diagram-craft/geometry/box';
import type { Stencil } from './stencilRegistry';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';
import { isNode } from './diagramElement';
import { assertRegularLayer } from './diagramLayerUtils';
import { mustExist } from '@diagram-craft/utils/assert';
import { applyStencilToNode } from './stencilUtils';

const getSingleElementStencil = (
  diagram: ReturnType<typeof TestModel.newDiagram>,
  exclude: string
) => {
  return mustExist(
    diagram.document.registry.stencils
      .get('default')
      .stencils.find(stencil => {
        const elements = stencil.forCanvas(diagram.document.registry).elements;
        return elements.length === 1 && isNode(elements[0]) && elements[0].nodeType !== exclude;
      })
  );
};

const makeGroupStencil = (): Stencil => {
  const build = () => {
    const stencilDiagram = TestModel.newDiagram();
    const layer = stencilDiagram.newLayer();
    const first = layer.addNode({
      id: 'first',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 40, h: 20, r: 0 }
    });
    const second = layer.addNode({
      id: 'second',
      type: 'circle',
      bounds: { x: 60, y: 10, w: 30, h: 30, r: 0 }
    });

    return {
      bounds: Box.boundingBox([first.bounds, second.bounds]),
      elements: [first, second],
      diagram: stencilDiagram,
      layer
    };
  };

  return {
    id: 'test-group-stencil',
    type: 'default',
    forCanvas: () => build(),
    forPicker: () => build()
  };
};

describe('stencilUtils', () => {
  describe('applyStencilToNode', () => {
    test('replaces a node with a single-element stencil', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();
      const node = layer.addNode({
        id: 'source',
        type: 'rect',
        bounds: { x: 10, y: 20, w: 120, h: 80, r: 0 }
      });

      const stencil = getSingleElementStencil(diagram, node.nodeType);
      assertRegularLayer(diagram.activeLayer);
      const activeLayer = diagram.activeLayer;

      UnitOfWork.execute(diagram, uow => {
        applyStencilToNode(diagram, node, activeLayer, stencil, uow);
      });

      const stencilNode = stencil.forCanvas(diagram.document.registry).elements[0];
      expect(isNode(stencilNode)).toBe(true);
      if (!isNode(stencilNode)) throw new Error('Expected a node stencil');
      expect(node.nodeType).toBe(stencilNode.nodeType);
      expect(node.children).toHaveLength(stencilNode.children.length);
    });

    test('converts a node to a group for multi-element stencils', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();
      const node = layer.addNode({
        id: 'source',
        type: 'rect',
        bounds: { x: 100, y: 100, w: 150, h: 90, r: 0 }
      });

      const stencil = makeGroupStencil();
      assertRegularLayer(diagram.activeLayer);
      const activeLayer = diagram.activeLayer;

      UnitOfWork.execute(diagram, uow => {
        applyStencilToNode(diagram, node, activeLayer, stencil, uow);
      });

      expect(node.nodeType).toBe('group');
      expect(node.children.length).toBeGreaterThan(1);
      expect(node.bounds.x).toBe(100);
      expect(node.bounds.y).toBe(100);
      expect(node.bounds.w).toBe(150);
      expect(node.bounds.h).toBe(90);
    });

    test('can change a node that already has children', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();
      const parent = layer.addNode({
        id: 'parent',
        type: 'group',
        bounds: { x: 0, y: 0, w: 200, h: 150, r: 0 }
      });
      const child = layer.createNode({
        id: 'child',
        type: 'rect',
        bounds: { x: 20, y: 20, w: 40, h: 40, r: 0 }
      });

      UnitOfWork.execute(diagram, uow => {
        parent.setChildren([child], uow);
      });

      const stencil = getSingleElementStencil(diagram, parent.nodeType);
      assertRegularLayer(diagram.activeLayer);
      const activeLayer = diagram.activeLayer;

      UnitOfWork.execute(diagram, uow => {
        applyStencilToNode(diagram, parent, activeLayer, stencil, uow);
      });

      expect(parent.nodeType).not.toBe('group');
    });
  });
});
