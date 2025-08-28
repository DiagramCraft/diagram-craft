import { describe, expect, test } from 'vitest';
import { ElementAddUndoableAction, ElementDeleteUndoableAction } from './diagramUndoActions';
import { TestModel } from './test-support/builder';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint } from './endpoint';

describe('ElementAddUndoableAction', () => {
  test('should undo node addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.createNode('node1', 'rect');

    const action = new ElementAddUndoableAction([node], diagram, layer);
    layer.addElement(node, UnitOfWork.immediate(diagram));

    expect(diagram.lookup('node1')).toBe(node);

    action.undo(UnitOfWork.immediate(diagram));

    expect(diagram.lookup('node1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);
  });

  test('should redo node addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.createNode('node1', 'rect');

    const action = new ElementAddUndoableAction([node], diagram, layer);
    layer.addElement(node, UnitOfWork.immediate(diagram));

    action.undo(UnitOfWork.immediate(diagram));
    expect(diagram.lookup('node1')).toBeUndefined();

    action.redo();

    expect(diagram.lookup('node1')).toBe(node);
    expect(layer.elements).toHaveLength(1);
  });

  test('should undo edge addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.createEdge('edge1');

    const action = new ElementAddUndoableAction([edge], diagram, layer);
    layer.addElement(edge, UnitOfWork.immediate(diagram));

    expect(diagram.lookup('edge1')).toBe(edge);

    action.undo(UnitOfWork.immediate(diagram));

    expect(diagram.lookup('edge1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);
  });

  test('should undo multiple element addition', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.createNode('node1', 'rect');
    const node2 = layer.createNode('node2', 'rect');
    const edge = layer.createEdge('edge1');

    const action = new ElementAddUndoableAction([node1, node2, edge], diagram, layer);
    layer.addElement(node1, UnitOfWork.immediate(diagram));
    layer.addElement(node2, UnitOfWork.immediate(diagram));
    layer.addElement(edge, UnitOfWork.immediate(diagram));

    expect(layer.elements).toHaveLength(3);

    action.undo(UnitOfWork.immediate(diagram));

    expect(layer.elements).toHaveLength(0);
    expect(diagram.lookup('node1')).toBeUndefined();
    expect(diagram.lookup('node2')).toBeUndefined();
    expect(diagram.lookup('edge1')).toBeUndefined();
  });

  test('should handle edge-node connections correctly', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode('node1', 'rect');
    const node2 = layer.addNode('node2', 'rect');
    const edge = layer.createEdge('edge1');

    // Connect edge to nodes
    const uow = UnitOfWork.immediate(diagram);
    edge.setStart(new AnchorEndpoint(node1, 'c'), uow);
    edge.setEnd(new AnchorEndpoint(node2, 'c'), uow);

    const action = new ElementAddUndoableAction([edge], diagram, layer);
    layer.addElement(edge, uow);

    // Verify edge is connected initially
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);

    // Test undo - edge should be removed
    action.undo(UnitOfWork.immediate(diagram));
    expect(diagram.lookup('edge1')).toBeUndefined();

    // Test redo - edge should be restored with connections
    action.redo();
    expect(diagram.lookup('edge1')).toBe(edge);
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
  });
});

describe('ElementDeleteUndoableAction', () => {
  test('should undo node deletion', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode('node1', 'rect');

    const action = new ElementDeleteUndoableAction(diagram, layer, [node], false);
    action.redo(UnitOfWork.immediate(diagram));

    expect(diagram.lookup('node1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);

    action.undo(UnitOfWork.immediate(diagram));

    expect(diagram.lookup('node1')).toBe(node);
    expect(layer.elements).toHaveLength(1);
  });

  test('should undo edge deletion', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge('edge1');

    const action = new ElementDeleteUndoableAction(diagram, layer, [edge], false);
    action.redo(UnitOfWork.immediate(diagram));

    expect(diagram.lookup('edge1')).toBeUndefined();
    expect(layer.elements).toHaveLength(0);

    action.undo(UnitOfWork.immediate(diagram));

    expect(diagram.lookup('edge1')).toBe(edge);
    expect(layer.elements).toHaveLength(1);
  });

  test('should undo multiple element deletion', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.addNode('node1', 'rect');
    const node2 = layer.addNode('node2', 'rect');
    const edge = layer.addEdge('edge1');

    const action = new ElementDeleteUndoableAction(diagram, layer, [node1, node2, edge], false);
    action.redo(UnitOfWork.immediate(diagram));

    expect(layer.elements).toHaveLength(0);

    action.undo(UnitOfWork.immediate(diagram));

    expect(layer.elements).toHaveLength(3);
    expect(diagram.lookup('node1')).toBe(node1);
    expect(diagram.lookup('node2')).toBe(node2);
    expect(diagram.lookup('edge1')).toBe(edge);
  });

  test('should restore node connections when edge is restored', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode('node1', 'rect');
    const node2 = layer.addNode('node2', 'rect');
    const edge = layer.addEdge('edge1');

    // Connect edge to nodes
    const uow = UnitOfWork.immediate(diagram);
    edge.setStart(new AnchorEndpoint(node1, 'c'), uow);
    edge.setEnd(new AnchorEndpoint(node2, 'c'), uow);

    // Verify connections before deletion
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
    expect(node1.listEdges()).toContain(edge);
    expect(node2.listEdges()).toContain(edge);

    // Delete and restore edge
    const action = new ElementDeleteUndoableAction(diagram, layer, [edge], false);
    action.redo(UnitOfWork.immediate(diagram));

    expect(node1.listEdges()).not.toContain(edge);
    expect(node2.listEdges()).not.toContain(edge);

    action.undo(UnitOfWork.immediate(diagram));

    // Verify connections are restored
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
    expect(node1.listEdges()).toContain(edge);
    expect(node2.listEdges()).toContain(edge);
  });

  test('should restore node connections when node is restored', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode('node1', 'rect');
    const node2 = layer.addNode('node2', 'rect');
    const edge = layer.addEdge('edge1');

    // Connect edge to nodes
    const uow = UnitOfWork.immediate(diagram);
    edge.setStart(new AnchorEndpoint(node1, 'c'), uow);
    edge.setEnd(new AnchorEndpoint(node2, 'c'), uow);

    // Verify connections before deletion
    expect(node1.listEdges()).toContain(edge);
    expect((edge.start as AnchorEndpoint).node).toBe(node1);

    // Delete and restore node1
    const action = new ElementDeleteUndoableAction(diagram, layer, [node1], false);
    action.redo(UnitOfWork.immediate(diagram));

    action.undo(UnitOfWork.immediate(diagram));

    // Verify node1 connection is restored
    expect(node1.listEdges()).toContain(edge);
    expect((edge.start as AnchorEndpoint).node).toBe(node1);
    expect((edge.end as AnchorEndpoint).node).toBe(node2);
  });

  test('should restore both nodes and connected edges', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const node1 = layer.addNode('node1', 'rect');
    const node2 = layer.addNode('node2', 'rect');
    const edge1 = layer.addEdge('edge1');
    const edge2 = layer.addEdge('edge2');

    // Connect edges to nodes
    const uow = UnitOfWork.immediate(diagram);
    edge1.setStart(new AnchorEndpoint(node1, 'c'), uow);
    edge1.setEnd(new AnchorEndpoint(node2, 'c'), uow);
    edge2.setStart(new AnchorEndpoint(node1, 't'), uow);
    edge2.setEnd(new AnchorEndpoint(node2, 'b'), uow);

    // Delete all elements and restore
    const action = new ElementDeleteUndoableAction(
      diagram,
      layer,
      [node1, node2, edge1, edge2],
      false
    );
    action.redo(UnitOfWork.immediate(diagram));

    expect(layer.elements).toHaveLength(0);

    action.undo(UnitOfWork.immediate(diagram));

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
    expect(node1.listEdges()).toContain(edge1);
    expect(node1.listEdges()).toContain(edge2);
    expect(node2.listEdges()).toContain(edge1);
    expect(node2.listEdges()).toContain(edge2);
  });

  test('should handle selection restoration', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode('node1', 'rect');

    diagram.selectionState.setElements([node]);
    expect(diagram.selectionState.elements).toContain(node);

    const action = new ElementDeleteUndoableAction(diagram, layer, [node], true);
    action.redo(UnitOfWork.immediate(diagram));

    expect(diagram.selectionState.elements).toHaveLength(0);

    action.undo(UnitOfWork.immediate(diagram));

    expect(diagram.selectionState.elements).toContain(node);
  });
});
