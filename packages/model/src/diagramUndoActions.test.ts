import { describe, expect, test } from 'vitest';
import { ElementAddUndoableAction } from './diagramUndoActions';
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
