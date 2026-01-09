import { beforeEach, describe, expect, test } from 'vitest';
import { GroupAction } from './groupAction';
import type {
  TestDiagramBuilder,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/testModel';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';
import { isNode } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

const mockContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe('GroupAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
  });

  describe('group', () => {
    test('should create a group from multiple selected nodes', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      const initialNodeCount = layer.elements.filter(isNode).length;

      new GroupAction('group', mockContext(diagram)).execute();

      expect(layer.elements.filter(isNode).length).toBe(initialNodeCount - 1);

      const groupNode = layer.elements
        .filter(isNode)
        .find(n => n.nodeType === 'group') as DiagramNode;
      expect(groupNode).toBeDefined();
      expect(groupNode!.children.map(e => e.id)).toEqual([node1.id, node2.id]);
      expect(groupNode!.bounds).toStrictEqual({ x: 10, y: 10, w: 240, h: 240, r: 0 });
      expect(diagram.selection.elements[0]).toBe(groupNode);

      // Original nodes should not be in layer's elements anymore
      expect(layer.elements).not.toContain(node1);
      expect(layer.elements).not.toContain(node2);

      // Children should be sorted by layer order
      expect(groupNode!.children[0]).toBe(node1);
      expect(groupNode!.children[1]).toBe(node2);
    });
  });

  describe('ungroup', () => {
    test('should ungroup a group node back to individual nodes', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      new GroupAction('group', mockContext(diagram)).execute();

      const groupNode = diagram.selection.elements[0] as DiagramNode;
      expect(groupNode.nodeType).toBe('group');

      const initialNodeCount = layer.elements.filter(isNode).length;

      expect(groupNode.children).toHaveLength(2);

      // Now ungroup
      new GroupAction('ungroup', mockContext(diagram)).execute();

      const finalNodeCount = layer.elements.filter(isNode).length;

      // Should have two nodes instead of the group
      expect(finalNodeCount).toBe(initialNodeCount + 1);

      // Original nodes should be back in the layer
      expect(layer.elements).toContain(node1);
      expect(layer.elements).toContain(node2);

      // Group node should no longer exist in layer
      expect(layer.elements).not.toContain(groupNode);

      // Selection should be updated to the ungrouped nodes
      expect(diagram.selection.elements.map(e => e.id)).toEqual([node1.id, node2.id]);
    });
  });

  describe('undo/redo', () => {
    test('should undo group operation', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      new GroupAction('group', mockContext(diagram)).execute();

      const groupNode = diagram.selection.elements[0] as DiagramNode;
      expect(groupNode.nodeType).toBe('group');

      // Undo
      diagram.undoManager.undo();

      // Nodes should be back in layer
      expect(layer.elements.map(e => e.id)).toContain(node1.id);
      expect(layer.elements.map(e => e.id)).toContain(node2.id);

      // Group should be removed
      expect(layer.elements).not.toContain(groupNode);

      // Selection should be back to original nodes
      expect(diagram.selection.elements.map(e => e.id)).toEqual([node1.id, node2.id]);
    });

    test('should redo group operation', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      new GroupAction('group', mockContext(diagram)).execute();

      // Undo
      diagram.undoManager.undo();

      // Redo
      diagram.undoManager.redo();

      // Group should be recreated
      const groupNodes = layer.elements.filter(isNode).filter(n => n.nodeType === 'group');
      expect(groupNodes).toHaveLength(1);

      // Selection should be the group
      expect(diagram.selection.elements).toHaveLength(1);
      expect((diagram.selection.elements[0] as DiagramNode).nodeType).toBe('group');
    });

    test('should undo ungroup operation', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      // Group
      new GroupAction('group', mockContext(diagram)).execute();

      // Ungroup
      new GroupAction('ungroup', mockContext(diagram)).execute();

      // Undo the ungroup
      diagram.undoManager.undo();

      // Group should be back
      const groupNodes = layer.elements.filter(isNode).filter(n => n.nodeType === 'group');
      expect(groupNodes).toHaveLength(1);

      // Selection should be the group
      expect(diagram.selection.elements).toHaveLength(1);
      expect((diagram.selection.elements[0] as DiagramNode).nodeType).toBe('group');
    });

    test('should redo ungroup operation', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      // Group
      new GroupAction('group', mockContext(diagram)).execute();

      // Ungroup
      new GroupAction('ungroup', mockContext(diagram)).execute();

      // Undo
      diagram.undoManager.undo();

      // Redo
      diagram.undoManager.redo();

      // Should have ungrouped nodes back
      expect(layer.elements.map(e => e.id)).toContain(node1.id);
      expect(layer.elements.map(e => e.id)).toContain(node2.id);

      // No group nodes should exist
      const groupNodes = layer.elements.filter(isNode).filter(n => n.nodeType === 'group');
      expect(groupNodes).toHaveLength(0);
    });
  });

  describe('action availability', () => {
    test('group action should require multiple elements selected', () => {
      const node = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });

      diagram.selection.setElements([node]);

      const action = new GroupAction('group', mockContext(diagram));
      action.bindCriteria();

      // Should not be enabled with single element
      expect(action.isEnabled(undefined)).toBe(false);
    });

    test('ungroup action should be enabled when a group node is selected', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      // Create a group
      new GroupAction('group', mockContext(diagram)).execute();

      const action = new GroupAction('ungroup', mockContext(diagram));
      action.bindCriteria();

      expect(action.isEnabled(undefined)).toBe(true);
    });
  });

  describe('children with parents', () => {
    test('should handle grouping nodes that are children of other nodes', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 500, h: 500, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      // Set parent for both children
      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
      });

      diagram.selection.setElements([child1, child2]);

      // Group the children
      new GroupAction('group', mockContext(diagram)).execute();

      const groupNode = diagram.selection.elements[0] as DiagramNode;

      // Group should be created
      expect(groupNode.nodeType).toBe('group');
      expect(groupNode.children).toContain(child1);
      expect(groupNode.children).toContain(child2);

      // Group should be in layer
      expect(layer.elements).toContain(groupNode);
    });
  });
});
