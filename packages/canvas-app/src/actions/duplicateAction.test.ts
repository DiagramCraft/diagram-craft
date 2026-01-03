import { beforeEach, describe, expect, test } from 'vitest';
import { DuplicateAction } from './duplicateAction';
import {
  TestDiagramBuilder,
  TestLayerBuilder,
  TestModel
} from '@diagram-craft/model/test-support/testModel';
import { Diagram } from '@diagram-craft/model/diagram';
import { ActionContext } from '@diagram-craft/canvas/action';
import { AnchorEndpoint, FreeEndpoint, PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { Point } from '@diagram-craft/geometry/point';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

const mkContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

const OFFSET = 10;

describe('DuplicateAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
  });

  describe('nodes only', () => {
    test('should duplicate only selected nodes', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1]);

      const initialNodeCount = layer.elements.filter(isNode).length;
      const initialEdgeCount = layer.elements.filter(isEdge).length;

      new DuplicateAction(mkContext(diagram)).execute();

      const finalNodeCount = layer.elements.filter(isNode).length;
      const finalEdgeCount = layer.elements.filter(isEdge).length;

      expect(finalNodeCount).toBe(initialNodeCount + 1);
      expect(finalEdgeCount).toBe(initialEdgeCount); // No edges should be duplicated

      const duplicatedNode = layer.elements
        .filter(isNode)
        .find(n => n.id !== node1.id && n.id !== node2.id)!;
      expect(duplicatedNode).toBeDefined();
      expect(duplicatedNode.bounds.x).toBe(node1.bounds.x + OFFSET);
      expect(duplicatedNode.bounds.y).toBe(node1.bounds.y + OFFSET);
      expect(duplicatedNode.bounds.w).toBe(node1.bounds.w);
      expect(duplicatedNode.bounds.h).toBe(node1.bounds.h);

      // Selection should be updated to the duplicated node
      expect(diagram.selection.elements).toHaveLength(1);
      expect(diagram.selection.elements[0]).toBe(duplicatedNode);
    });

    test('should duplicate multiple selected nodes', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      diagram.selection.setElements([node1, node2]);

      const initialNodeCount = layer.elements.filter(isNode).length;

      new DuplicateAction(mkContext(diagram)).execute();

      const finalNodeCount = layer.elements.filter(isNode).length;
      expect(finalNodeCount).toBe(initialNodeCount + 2);

      // Selection should contain the two duplicated nodes
      expect(diagram.selection.elements).toHaveLength(2);
      expect(diagram.selection.elements.every(isNode)).toBe(true);
    });
  });

  describe('edges only', () => {
    test('should duplicate selected edge with disconnected endpoints', () => {
      const edge = layer.addEdge();

      diagram.selection.setElements([edge]);

      const initialEdgeCount = layer.elements.filter(isEdge).length;

      new DuplicateAction(mkContext(diagram)).execute();

      const finalEdgeCount = layer.elements.filter(isEdge).length;
      expect(finalEdgeCount).toBe(initialEdgeCount + 1);

      const duplicatedEdge = layer.elements.filter(isEdge).find(e => e.id !== edge.id)!;
      expect(duplicatedEdge).toBeDefined();

      // Both endpoints should be FreeEndpoints (disconnected)
      expect(duplicatedEdge.start).toBeInstanceOf(FreeEndpoint);
      expect(duplicatedEdge.end).toBeInstanceOf(FreeEndpoint);

      // Selection should be updated to the duplicated edge
      expect(diagram.selection.elements).toHaveLength(1);
      expect(diagram.selection.elements[0]).toBe(duplicatedEdge);
    });
  });

  describe('nodes and edges', () => {
    test('should duplicate selected nodes and reconnect selected edge to duplicated nodes', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      // Create an edge connecting the two nodes
      const connectedEdge = ElementFactory.edge(
        newid(),
        new AnchorEndpoint(node1, 'c', Point.ORIGIN),
        new AnchorEndpoint(node2, 'c', Point.ORIGIN),
        {},
        {},
        [],
        layer
      );
      UnitOfWork.execute(diagram, uow => layer.addElement(connectedEdge, uow));

      diagram.selection.setElements([node1, node2, connectedEdge]);

      const initialNodeCount = layer.elements.filter(isNode).length;
      const initialEdgeCount = layer.elements.filter(isEdge).length;

      new DuplicateAction(mkContext(diagram)).execute();

      const finalNodeCount = layer.elements.filter(isNode).length;
      const finalEdgeCount = layer.elements.filter(isEdge).length;

      expect(finalNodeCount).toBe(initialNodeCount + 2);
      expect(finalEdgeCount).toBe(initialEdgeCount + 1);

      const duplicatedNodes = layer.elements
        .filter(isNode)
        .filter(n => n.id !== node1.id && n.id !== node2.id);
      const duplicatedEdges = layer.elements.filter(isEdge).filter(e => e.id !== connectedEdge.id);

      expect(duplicatedNodes).toHaveLength(2);
      expect(duplicatedEdges).toHaveLength(1);

      const duplicatedEdge = duplicatedEdges[0]!;

      // The duplicated edge should connect to the duplicated nodes
      expect(duplicatedEdge.start).toBeInstanceOf(AnchorEndpoint);
      expect(duplicatedEdge.end).toBeInstanceOf(AnchorEndpoint);

      const startNodeId = (duplicatedEdge.start as AnchorEndpoint).node.id;
      const endNodeId = (duplicatedEdge.end as AnchorEndpoint).node.id;

      expect(duplicatedNodes.some(n => n.id === startNodeId)).toBe(true);
      expect(duplicatedNodes.some(n => n.id === endNodeId)).toBe(true);

      // Selection should contain all duplicated elements
      expect(diagram.selection.elements).toHaveLength(3);
    });

    test('should duplicate selected edge and partially disconnect when only one connected node is selected', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      // Create an edge connecting the two nodes
      const connectedEdge = ElementFactory.edge(
        newid(),
        new AnchorEndpoint(node1, 'c', Point.ORIGIN),
        new AnchorEndpoint(node2, 'c', Point.ORIGIN),
        {},
        {},
        [],
        layer
      );
      UnitOfWork.execute(diagram, uow => layer.addElement(connectedEdge, uow));

      // Select only one node and the edge
      diagram.selection.setElements([node1, connectedEdge]);

      new DuplicateAction(mkContext(diagram)).execute();

      const duplicatedNodes = layer.elements
        .filter(isNode)
        .filter(n => n.id !== node1.id && n.id !== node2.id);
      const duplicatedEdges = layer.elements.filter(isEdge).filter(e => e.id !== connectedEdge.id);

      expect(duplicatedNodes).toHaveLength(1);
      expect(duplicatedEdges).toHaveLength(1);

      const duplicatedEdge = duplicatedEdges[0]!;
      const duplicatedNode = duplicatedNodes[0]!;

      // The duplicated edge should connect to the duplicated node on one end and be free on the other
      if ((duplicatedEdge.start as AnchorEndpoint).node?.id === duplicatedNode.id) {
        expect(duplicatedEdge.start).toBeInstanceOf(AnchorEndpoint);
        expect(duplicatedEdge.end).toBeInstanceOf(FreeEndpoint);
      } else {
        expect(duplicatedEdge.start).toBeInstanceOf(FreeEndpoint);
        expect(duplicatedEdge.end).toBeInstanceOf(AnchorEndpoint);
        expect((duplicatedEdge.end as AnchorEndpoint).node.id).toBe(duplicatedNode.id);
      }
    });

    test('should preserve endpoint properties when reconnecting', () => {
      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      // Create an edge with specific endpoint properties
      const connectedEdge = ElementFactory.edge(
        newid(),
        new AnchorEndpoint(node1, 'top', { x: 5, y: 5 }),
        new PointInNodeEndpoint(node2, { x: 0.5, y: 0.5 }, { x: 10, y: 10 }, 'relative'),
        {},
        {},
        [],
        layer
      );
      UnitOfWork.execute(diagram, uow => layer.addElement(connectedEdge, uow));

      diagram.selection.setElements([node1, node2, connectedEdge]);

      new DuplicateAction(mkContext(diagram)).execute();

      const duplicatedEdges = layer.elements.filter(isEdge).filter(e => e.id !== connectedEdge.id);
      const duplicatedEdge = duplicatedEdges[0]!;

      // Check that endpoint properties are preserved
      expect(duplicatedEdge.start).toBeInstanceOf(AnchorEndpoint);
      expect(duplicatedEdge.end).toBeInstanceOf(PointInNodeEndpoint);

      const startEndpoint = duplicatedEdge.start as AnchorEndpoint;
      const endEndpoint = duplicatedEdge.end as PointInNodeEndpoint;

      expect(startEndpoint.anchorId).toBe('top');
      expect(startEndpoint.offset).toEqual({ x: 5, y: 5 });

      expect(endEndpoint.ref).toEqual({ x: 0.5, y: 0.5 });
      expect(endEndpoint.offset).toEqual({ x: 10, y: 10 });
      expect(endEndpoint.offsetType).toBe('relative');
    });
  });

  describe('selection state', () => {
    test('should update selection to duplicated elements', () => {
      const node = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const edge = layer.addEdge();

      diagram.selection.setElements([node, edge]);

      new DuplicateAction(mkContext(diagram)).execute();

      // Selection should contain the duplicated elements
      expect(diagram.selection.elements).toHaveLength(2);
      expect(diagram.selection.elements.some(isNode)).toBe(true);
      expect(diagram.selection.elements.some(isEdge)).toBe(true);

      // None of the selected elements should be the original elements
      expect(diagram.selection.elements.includes(node)).toBe(false);
      expect(diagram.selection.elements.includes(edge)).toBe(false);
    });
  });

  describe('positioning', () => {
    test('should offset duplicated elements by OFFSET pixels', () => {
      const node = layer.addNode({ bounds: { x: 50, y: 50, w: 100, h: 100, r: 0 } });

      diagram.selection.setElements([node]);

      new DuplicateAction(mkContext(diagram)).execute();

      const duplicatedNode = layer.elements.filter(isNode).find(n => n.id !== node.id)!;

      expect(duplicatedNode.bounds.x).toBe(node.bounds.x + OFFSET);
      expect(duplicatedNode.bounds.y).toBe(node.bounds.y + OFFSET);
    });
  });

  describe('parent preservation', () => {
    test('should preserve parent when all selected elements have the same parent', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 500, h: 500, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

      // Set parent for both children
      UnitOfWork.execute(diagram, uow => {
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
      });

      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
      expect(parent.children).toHaveLength(2);

      // Select both children and duplicate
      diagram.selection.setElements([child1, child2]);

      new DuplicateAction(mkContext(diagram)).execute();

      // Parent should now have 4 children (2 original + 2 duplicated)
      expect(parent.children).toHaveLength(4);

      // Find duplicated nodes (they should be in parent's children)
      const duplicatedNodes = parent.children.filter(
        c => isNode(c) && c.id !== child1.id && c.id !== child2.id
      );

      expect(duplicatedNodes).toHaveLength(2);

      // Both duplicated nodes should have the same parent
      expect(duplicatedNodes[0]!.parent).toBe(parent);
      expect(duplicatedNodes[1]!.parent).toBe(parent);
    });

    test('should not set parent when selected elements have different parents', () => {
      const parent1 = layer.addNode({ bounds: { x: 0, y: 0, w: 500, h: 500, r: 0 } });
      const parent2 = layer.addNode({ bounds: { x: 600, y: 0, w: 500, h: 500, r: 0 } });
      const child1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const child2 = layer.addNode({ bounds: { x: 610, y: 10, w: 50, h: 50, r: 0 } });

      // Set different parents
      UnitOfWork.execute(diagram, uow => {
        parent1.addChild(child1, uow);
        parent2.addChild(child2, uow);
      });

      expect(child1.parent).toBe(parent1);
      expect(child2.parent).toBe(parent2);

      // Select both children and duplicate
      diagram.selection.setElements([child1, child2]);

      new DuplicateAction(mkContext(diagram)).execute();

      // Find duplicated nodes
      const duplicatedNodes = layer.elements
        .filter(isNode)
        .filter(
          n =>
            n.id !== parent1.id && n.id !== parent2.id && n.id !== child1.id && n.id !== child2.id
        );

      expect(duplicatedNodes).toHaveLength(2);

      // Duplicated nodes should not have a parent
      expect(duplicatedNodes[0]!.parent).toBeUndefined();
      expect(duplicatedNodes[1]!.parent).toBeUndefined();
    });

    test('should not set parent when some selected elements have no parent', () => {
      const parent = layer.addNode({ bounds: { x: 0, y: 0, w: 500, h: 500, r: 0 } });
      const child = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
      const orphan = layer.addNode({ bounds: { x: 600, y: 10, w: 50, h: 50, r: 0 } });

      // Set parent only for child
      UnitOfWork.execute(diagram, uow => parent.addChild(child, uow));

      expect(child.parent).toBe(parent);
      expect(orphan.parent).toBeUndefined();

      // Select both child and orphan and duplicate
      diagram.selection.setElements([child, orphan]);

      new DuplicateAction(mkContext(diagram)).execute();

      // Find duplicated nodes
      const duplicatedNodes = layer.elements
        .filter(isNode)
        .filter(n => n.id !== parent.id && n.id !== child.id && n.id !== orphan.id);

      expect(duplicatedNodes).toHaveLength(2);

      // Duplicated nodes should not have a parent (because they don't all have the same parent)
      expect(duplicatedNodes[0]!.parent).toBeUndefined();
      expect(duplicatedNodes[1]!.parent).toBeUndefined();
    });
  });
});
