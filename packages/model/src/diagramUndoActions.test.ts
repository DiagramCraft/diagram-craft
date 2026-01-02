import { describe, expect, test } from 'vitest';
import { ElementAddUndoableAction, ElementDeleteUndoableAction } from './diagramUndoActions';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint } from './endpoint';

describe('ElementAddUndoableAction', () => {
  test('should undo node addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.createNode({ id: 'node1' });

    const action = new ElementAddUndoableAction([node], diagram, layer);
    UnitOfWork.execute(diagram, uow => layer.addElement(node, uow));

    expect(diagram.lookup('node1')).toBe(node);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(diagram.lookup('node1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);
  });

  test('should redo node addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.createNode({ id: 'node1' });

    const action = new ElementAddUndoableAction([node], diagram, layer);
    UnitOfWork.execute(diagram, uow => layer.addElement(node, uow));

    UnitOfWork.execute(diagram, uow => action.undo(uow));
    expect(diagram.lookup('node1')).toBeUndefined();

    action.redo();

    expect(diagram.lookup('node1')).toBe(node);
    expect(layer.elements).toHaveLength(1);
  });

  test('should undo edge addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.createEdge({ id: 'edge1' });

    const action = new ElementAddUndoableAction([edge], diagram, layer);
    UnitOfWork.execute(diagram, uow => layer.addElement(edge, uow));

    expect(diagram.lookup('edge1')).toBe(edge);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(diagram.lookup('edge1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);
  });

  test('should undo multiple element addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.createNode({ id: 'node1' });
    const node2 = layer.createNode({ id: 'node2' });
    const edge = layer.createEdge({ id: 'edge1' });

    const action = new ElementAddUndoableAction([node1, node2, edge], diagram, layer);
    UnitOfWork.execute(diagram, uow => {
      layer.addElement(node1, uow);
      layer.addElement(node2, uow);
      layer.addElement(edge, uow);
    });

    expect(layer.elements).toHaveLength(3);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(layer.elements).toHaveLength(0);
    expect(diagram.lookup('node1')).toBeUndefined();
    expect(diagram.lookup('node2')).toBeUndefined();
    expect(diagram.lookup('edge1')).toBeUndefined();
  });

  test('should handle edge-node connections correctly', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode();
    const node2 = layer.addNode();
    const edge = layer.createEdge({ id: 'edge1' });

    // Connect edge to nodes
    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new AnchorEndpoint(node1, 'c'), uow);
      edge.setEnd(new AnchorEndpoint(node2, 'c'), uow);

      const action = new ElementAddUndoableAction([edge], diagram, layer);
      layer.addElement(edge, uow);

      // Verify edge is connected initially
      expect((edge.start as AnchorEndpoint).node).toBe(node1);
      expect((edge.end as AnchorEndpoint).node).toBe(node2);

      // Test undo - edge should be removed
      action.undo(uow);
      expect(diagram.lookup('edge1')).toBeUndefined();

      // Test redo - edge should be restored with connections
      action.redo();
      expect(diagram.lookup('edge1')).toBe(edge);
      expect((edge.start as AnchorEndpoint).node).toBe(node1);
      expect((edge.end as AnchorEndpoint).node).toBe(node2);
    });
  });
});

describe('ElementDeleteUndoableAction', () => {
  test('should undo node deletion', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'node1' });

    const action = new ElementDeleteUndoableAction(diagram, layer, [node], false);
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    expect(diagram.lookup('node1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(diagram.lookup('node1')).toBe(node);
    expect(layer.elements).toHaveLength(1);
  });

  test('should undo edge deletion', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge({ id: 'edge1' });

    const action = new ElementDeleteUndoableAction(diagram, layer, [edge], false);
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    expect(diagram.lookup('edge1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(diagram.lookup('edge1')).toBe(edge);
    expect(layer.elements).toHaveLength(1);
  });

  test('should undo multiple element deletion', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.addNode({ id: 'node1' });
    const node2 = layer.addNode({ id: 'node2' });
    const edge = layer.addEdge({ id: 'edge1' });

    const action = new ElementDeleteUndoableAction(diagram, layer, [node1, node2, edge], false);
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    expect(layer.elements).toHaveLength(0);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(layer.elements).toHaveLength(3);
    expect(diagram.lookup('node1')).toBe(node1);
    expect(diagram.lookup('node2')).toBe(node2);
    expect(diagram.lookup('edge1')).toBe(edge);
  });

  test('should restore node connections when edge is restored', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode();
    const node2 = layer.addNode();
    const edge = layer.addEdge();

    // Connect edge to nodes
    UnitOfWork.execute(diagram, uow => edge.setStart(new AnchorEndpoint(node1, 'c'), uow));
    UnitOfWork.execute(diagram, uow => edge.setEnd(new AnchorEndpoint(node2, 'c'), uow));

    // Verify connections before deletion
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
    expect(node1.edges).toContain(edge);
    expect(node2.edges).toContain(edge);

    // Delete and restore edge
    const action = new ElementDeleteUndoableAction(diagram, layer, [edge], false);
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    expect(node1.edges).not.toContain(edge);
    expect(node2.edges).not.toContain(edge);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    // Verify connections are restored
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
    expect(node1.edges).toContain(edge);
    expect(node2.edges).toContain(edge);
  });

  test('should restore node connections when node is restored', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode();
    const node2 = layer.addNode();
    const edge = layer.addEdge();

    // Connect edge to nodes
    UnitOfWork.execute(diagram, uow => edge.setStart(new AnchorEndpoint(node1, 'c'), uow));
    UnitOfWork.execute(diagram, uow => edge.setEnd(new AnchorEndpoint(node2, 'c'), uow));

    // Verify connections before deletion
    expect(node1.edges).toContain(edge);
    expect((edge.start as AnchorEndpoint).node).toBe(node1);

    // Delete and restore node1
    const action = new ElementDeleteUndoableAction(diagram, layer, [node1], false);
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    // Verify node1 connection is restored
    expect(node1.edges).toContain(edge);
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
  });

  test('should restore both nodes and connected edges', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode({ id: 'node1' });
    const node2 = layer.addNode({ id: 'node2' });
    const edge1 = layer.addEdge({ id: 'edge1' });
    const edge2 = layer.addEdge({ id: 'edge2' });

    // Connect edges to nodes
    UnitOfWork.execute(diagram, uow => {
      edge1.setStart(new AnchorEndpoint(node1, 'c'), uow);
      edge1.setEnd(new AnchorEndpoint(node2, 'c'), uow);
      edge2.setStart(new AnchorEndpoint(node1, 't'), uow);
      edge2.setEnd(new AnchorEndpoint(node2, 'b'), uow);
    });

    // Delete all elements and restore
    const action = new ElementDeleteUndoableAction(
      diagram,
      layer,
      [node1, node2, edge1, edge2],
      false
    );
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    expect(layer.elements).toHaveLength(0);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    // Verify all elements and connections are restored
    expect(layer.elements).toHaveLength(4);
    expect(diagram.lookup('node1')).toBe(node1);
    expect(diagram.lookup('node2')).toBe(node2);
    expect(diagram.lookup('edge1')).toBe(edge1);
    expect(diagram.lookup('edge2')).toBe(edge2);

    // Verify connections are restored
    expect((edge1.start as AnchorEndpoint).node).toBe(node1);
    expect((edge1.end as AnchorEndpoint).node).toBe(node2);
    expect((edge2.start as AnchorEndpoint).node).toBe(node1);
    expect((edge2.end as AnchorEndpoint).node).toBe(node2);
    expect(node1.edges).toContain(edge1);
    expect(node1.edges).toContain(edge2);
    expect(node2.edges).toContain(edge1);
    expect(node2.edges).toContain(edge2);
  });

  test('should handle selection restoration', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode();

    diagram.selection.setElements([node]);
    expect(diagram.selection.elements).toContain(node);

    const action = new ElementDeleteUndoableAction(diagram, layer, [node], true);
    UnitOfWork.execute(diagram, uow => action.redo(uow));

    expect(diagram.selection.elements).toHaveLength(0);

    UnitOfWork.execute(diagram, uow => action.undo(uow));

    expect(diagram.selection.elements).toContain(node);
  });
});
