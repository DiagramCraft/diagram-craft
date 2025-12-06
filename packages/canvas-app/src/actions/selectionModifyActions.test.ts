import { describe, test, expect, beforeEach } from 'vitest';
import { SelectionSelectGrowAction, SelectionSelectShrinkAction } from './selectionModifyActions';
import { ActionContext } from '@diagram-craft/canvas/action';
import { model } from '@diagram-craft/canvas/modelState';
import {
  TestDiagramBuilder,
  TestModel,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/testModel';

const context: ActionContext = { model };

describe('SelectionSelectGrowAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    model.activeDiagram = diagram;
  });

  test('should grow selection from a node to include its connected edges', () => {
    // Setup: Create two nodes connected by an edge
    const node1 = layer.addNode({ id: 'node1', bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node2', bounds: { x: 100, y: 0, w: 50, h: 50, r: 0 } });
    layer.addEdge({ id: 'edge1', startNodeId: 'node1', endNodeId: 'node2' });

    // Select only the first node
    diagram.selection.setElements([node1]);

    // Act: Execute grow action
    const action = new SelectionSelectGrowAction(context);
    action.execute();

    // Verify: Should now have both the node and the edge selected
    expect(diagram.selection.elements).toHaveLength(2);
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node1');
    expect(diagram.selection.edges.map(e => e.id)).toContain('edge1');
  });

  test('should grow selection from an edge to include its connected nodes', () => {
    // Setup: Create two nodes connected by an edge
    layer.addNode({ id: 'node1', bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node2', bounds: { x: 100, y: 0, w: 50, h: 50, r: 0 } });
    const edge1 = layer.addEdge({ id: 'edge1', startNodeId: 'node1', endNodeId: 'node2' });

    // Select only the edge
    diagram.selection.setElements([edge1]);

    // Act: Execute grow action
    const action = new SelectionSelectGrowAction(context);
    action.execute();

    // Verify: Should now have the edge and both nodes selected
    expect(diagram.selection.elements).toHaveLength(3);
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node1');
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node2');
    expect(diagram.selection.edges.map(e => e.id)).toContain('edge1');
  });

  test('should grow selection from multiple nodes to include all connected edges', () => {
    // Setup: Create three nodes with edges between them
    const node1 = layer.addNode({ id: 'node1', bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 } });
    const node2 = layer.addNode({ id: 'node2', bounds: { x: 100, y: 0, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node3', bounds: { x: 200, y: 0, w: 50, h: 50, r: 0 } });
    layer.addEdge({ id: 'edge1', startNodeId: 'node1', endNodeId: 'node2' });
    layer.addEdge({ id: 'edge2', startNodeId: 'node2', endNodeId: 'node3' });

    // Select the first two nodes
    diagram.selection.setElements([node1, node2]);

    // Act: Execute grow action
    const action = new SelectionSelectGrowAction(context);
    action.execute();

    // Verify: Should have both nodes and both edges selected
    expect(diagram.selection.elements).toHaveLength(4);
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node1');
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node2');
    expect(diagram.selection.edges.map(e => e.id)).toContain('edge1');
    expect(diagram.selection.edges.map(e => e.id)).toContain('edge2');
  });
});

describe('SelectionSelectShrinkAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    model.activeDiagram = diagram;
  });

  test('should shrink selection by removing elements with fewest connections', () => {
    // Setup: Create a chain of three nodes connected by edges
    const node1 = layer.addNode({ id: 'node1', bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 } });
    const node2 = layer.addNode({ id: 'node2', bounds: { x: 100, y: 0, w: 50, h: 50, r: 0 } });
    const node3 = layer.addNode({ id: 'node3', bounds: { x: 200, y: 0, w: 50, h: 50, r: 0 } });
    const edge1 = layer.addEdge({ id: 'edge1', startNodeId: 'node1', endNodeId: 'node2' });
    const edge2 = layer.addEdge({ id: 'edge2', startNodeId: 'node2', endNodeId: 'node3' });

    // Select all nodes and edges
    diagram.selection.setElements([node1, node2, node3, edge1, edge2]);

    // Act: Execute shrink action
    const action = new SelectionSelectShrinkAction(context);
    action.execute();

    // Verify: Should remove the leaf nodes and edges with only one connection
    expect(diagram.selection.elements.length).toBeLessThan(5);
  });

  test('should not shrink if selection is empty', () => {
    // Setup: Empty selection
    diagram.selection.clear();

    // Act: Execute shrink action
    const action = new SelectionSelectShrinkAction(context);
    action.execute();

    // Verify: Should still be empty
    expect(diagram.selection.elements).toHaveLength(0);
  });

  test('should shrink a star topology by removing outer edges and nodes', () => {
    // Setup: Create a star topology with center node connected to 3 outer nodes
    const center = layer.addNode({ id: 'center', bounds: { x: 100, y: 100, w: 50, h: 50, r: 0 } });
    const node1 = layer.addNode({ id: 'node1', bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 } });
    const node2 = layer.addNode({ id: 'node2', bounds: { x: 200, y: 0, w: 50, h: 50, r: 0 } });
    const node3 = layer.addNode({ id: 'node3', bounds: { x: 100, y: 200, w: 50, h: 50, r: 0 } });
    const edge1 = layer.addEdge({ id: 'edge1', startNodeId: 'center', endNodeId: 'node1' });
    const edge2 = layer.addEdge({ id: 'edge2', startNodeId: 'center', endNodeId: 'node2' });
    const edge3 = layer.addEdge({ id: 'edge3', startNodeId: 'center', endNodeId: 'node3' });

    // Select all nodes and edges
    diagram.selection.setElements([center, node1, node2, node3, edge1, edge2, edge3]);

    // Act: Execute shrink action
    const action = new SelectionSelectShrinkAction(context);
    action.execute();

    // Verify: Should remove outer nodes that have only one connection
    expect(diagram.selection.elements.length).toBeLessThan(7);
    // The center node should still be selected as it has multiple connections
    expect(diagram.selection.nodes.map(n => n.id)).toContain('center');
  });
});
