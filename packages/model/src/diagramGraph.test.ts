import { beforeEach, describe, expect, test } from 'vitest';
import { DiagramGraph } from './diagramGraph';
import { TestDiagramBuilder, TestLayerBuilder, TestModel } from './test-support/testModel';
import { AnchorEndpoint } from './endpoint';
import { Point } from '@diagram-craft/geometry/point';
import { ElementFactory } from './elementFactory';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from './unitOfWork';

describe('DiagramGraph', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
  });

  test('should create empty graph for empty layer', () => {
    const graph = new DiagramGraph(layer);

    expect(Array.from(graph.vertices())).toHaveLength(0);
    expect(Array.from(graph.edges())).toHaveLength(0);
  });

  test('should add all nodes as vertices', () => {
    const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
    const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });
    const node3 = layer.addNode({ bounds: { x: 300, y: 300, w: 75, h: 75, r: 0 } });

    const graph = new DiagramGraph(layer);

    const vertices = Array.from(graph.vertices());
    expect(vertices).toHaveLength(3);

    const vertexIds = vertices.map(v => v.id);
    expect(vertexIds).toContain(node1.id);
    expect(vertexIds).toContain(node2.id);
    expect(vertexIds).toContain(node3.id);

    // Verify that vertex data points to the actual nodes
    expect(vertices.find(v => v.id === node1.id)?.data).toBe(node1);
    expect(vertices.find(v => v.id === node2.id)?.data).toBe(node2);
    expect(vertices.find(v => v.id === node3.id)?.data).toBe(node3);
  });

  test('should add connected edges', () => {
    const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
    const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

    const edge = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node1, 'c', Point.ORIGIN),
      new AnchorEndpoint(node2, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );
    UnitOfWork.execute(diagram, uow => layer.addElement(edge, uow));

    const graph = new DiagramGraph(layer);

    const edges = Array.from(graph.edges());
    expect(edges).toHaveLength(1);

    const graphEdge = edges[0]!;
    expect(graphEdge.id).toBe(edge.id);
    expect(graphEdge.from).toBe(node1.id);
    expect(graphEdge.to).toBe(node2.id);
    expect(graphEdge.weight).toBe(1);
    expect(graphEdge.data).toBe(edge);
  });

  test('should handle multiple edges between same nodes', () => {
    const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
    const node2 = layer.addNode({ bounds: { x: 200, y: 200, w: 50, h: 50, r: 0 } });

    const edge1 = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node1, 'c', Point.ORIGIN),
      new AnchorEndpoint(node2, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );
    const edge2 = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node1, 'c', Point.ORIGIN),
      new AnchorEndpoint(node2, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );
    UnitOfWork.execute(diagram, uow => layer.addElement(edge1, uow));
    UnitOfWork.execute(diagram, uow => layer.addElement(edge2, uow));

    const graph = new DiagramGraph(layer);

    const edges = Array.from(graph.edges());
    expect(edges).toHaveLength(2);

    expect(edges[0]!.from).toBe(node1.id);
    expect(edges[0]!.to).toBe(node2.id);
    expect(edges[1]!.from).toBe(node1.id);
    expect(edges[1]!.to).toBe(node2.id);
  });

  test('should create graph with complex structure', () => {
    // Create a graph structure:
    //   node1 -> node2 -> node3
    //     |                 ^
    //     +-> node4 --------+
    const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 100, h: 100, r: 0 } });
    const node2 = layer.addNode({ bounds: { x: 200, y: 10, w: 100, h: 100, r: 0 } });
    const node3 = layer.addNode({ bounds: { x: 400, y: 10, w: 100, h: 100, r: 0 } });
    const node4 = layer.addNode({ bounds: { x: 200, y: 200, w: 100, h: 100, r: 0 } });

    const edge1 = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node1, 'c', Point.ORIGIN),
      new AnchorEndpoint(node2, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );
    const edge2 = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node2, 'c', Point.ORIGIN),
      new AnchorEndpoint(node3, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );
    const edge3 = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node1, 'c', Point.ORIGIN),
      new AnchorEndpoint(node4, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );
    const edge4 = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(node4, 'c', Point.ORIGIN),
      new AnchorEndpoint(node3, 'c', Point.ORIGIN),
      {},
      {},
      [],
      layer
    );

    UnitOfWork.execute(diagram, uow => {
      layer.addElement(edge1, uow);
      layer.addElement(edge2, uow);
      layer.addElement(edge3, uow);
      layer.addElement(edge4, uow);
    });

    const graph = new DiagramGraph(layer);

    expect(Array.from(graph.vertices())).toHaveLength(4);
    expect(Array.from(graph.edges())).toHaveLength(4);

    // Verify all edges are correctly added
    const edges = Array.from(graph.edges());
    const edgeIds = edges.map(e => e.id);
    expect(edgeIds).toContain(edge1.id);
    expect(edgeIds).toContain(edge2.id);
    expect(edgeIds).toContain(edge3.id);
    expect(edgeIds).toContain(edge4.id);
  });
});
