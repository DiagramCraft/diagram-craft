import { describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { FreeEndpoint } from './endpoint';
import { TestModel } from './test-support/testModel';

describe('EdgeLabels (via SimpleDiagramEdge)', () => {
  describe('addChild/setLabelNodes sync', () => {
    it('creates a label node for a child added to the edge', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      const child = layer.createNode();

      UnitOfWork.execute(diagram, uow => edge.addChild(child, uow));

      expect(edge.labelNodes).toHaveLength(1);
      expect(edge.labelNodes[0]!.node().id).toBe(child.id);
    });

    it('removes the label node when the child is removed', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      const child = layer.createNode();

      UnitOfWork.execute(diagram, uow => edge.addChild(child, uow));
      UnitOfWork.execute(diagram, uow => edge.removeChild(child, uow));

      expect(edge.labelNodes).toHaveLength(0);
      expect(edge.children).toHaveLength(0);
    });

    it('adds a child to the element tree when a label node is set directly', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      const labelNode = layer.createNode().asLabelNode();

      UnitOfWork.execute(diagram, uow => edge.setLabelNodes([labelNode], uow));

      expect(edge.children).toEqual([labelNode.node()]);
    });

    it('removes children no longer present when label nodes are replaced', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      const labelNode1 = layer.createNode().asLabelNode();
      const labelNode2 = layer.createNode().asLabelNode();

      UnitOfWork.execute(diagram, uow => edge.setLabelNodes([labelNode1, labelNode2], uow));
      expect(edge.children).toHaveLength(2);

      UnitOfWork.execute(diagram, uow => edge.setLabelNodes([labelNode1], uow));
      expect(edge.children).toEqual([labelNode1.node()]);
    });
  });

  describe('consistency invariant', () => {
    it('holds after repeated add/remove of children and label nodes', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      const child1 = layer.createNode();
      const child2 = layer.createNode();
      const labelNode3 = layer.createNode().asLabelNode();

      expect(() =>
        UnitOfWork.execute(diagram, uow => {
          edge.addChild(child1, uow);
          edge.addChild(child2, uow);
          edge.removeChild(child1, uow);
          edge.addLabelNode(labelNode3, uow);
          edge.removeLabelNode(labelNode3, uow);
        })
      ).not.toThrow();

      expect(edge.labelNodes).toHaveLength(1);
      expect(edge.labelNodes[0]!.node().id).toBe(child2.id);
    });
  });

  describe('adjustPositions (via invalidate)', () => {
    it('positions a label node at its timeOffset along the edge path', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      UnitOfWork.execute(diagram, uow => {
        edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
        edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
      });

      const labelNode = { ...layer.createNode().asLabelNode(), timeOffset: 0.5 };
      UnitOfWork.execute(diagram, uow => edge.setLabelNodes([labelNode], uow));

      UnitOfWork.execute(diagram, uow => edge.invalidate('full', uow));

      const node = labelNode.node();
      // timeOffset 0.5 - so the node should be centered around the path midpoint, x=50
      expect(Math.abs(node.bounds.x + node.bounds.w / 2 - 50)).toBeLessThan(1);
    });
  });
});
