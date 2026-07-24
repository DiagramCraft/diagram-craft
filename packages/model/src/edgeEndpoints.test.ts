import { describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint, FreeEndpoint, PointOnEdgeEndpoint } from './endpoint';
import { TestModel } from './test-support/testModel';
import { ElementFactory } from './elementFactory';

describe('EdgeEndpoints (via SimpleDiagramEdge)', () => {
  describe('setStart/setEnd', () => {
    it('connects and disconnects node registration when the endpoint changes', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();
      const edge = layer.addEdge();

      UnitOfWork.execute(diagram, uow => edge.setStart(new AnchorEndpoint(node1, 'c'), uow));
      expect(node1.edges.map(e => e.id)).toContain(edge.id);

      UnitOfWork.execute(diagram, uow => edge.setStart(new AnchorEndpoint(node2, 'c'), uow));
      expect(node1.edges.map(e => e.id)).not.toContain(edge.id);
      expect(node2.edges.map(e => e.id)).toContain(edge.id);
    });

    it('rejects direct self-cycles', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      expect(() =>
        UnitOfWork.execute(diagram, uow => edge.setStart(new PointOnEdgeEndpoint(edge, 0.5), uow))
      ).toThrow();
    });

    it('rejects indirect (transitive) cycles', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const edgeA = ElementFactory.edge({
        start: new FreeEndpoint({ x: 0, y: 0 }),
        end: new FreeEndpoint({ x: 100, y: 0 }),
        layer
      });
      UnitOfWork.execute(diagram, uow => layer.addElement(edgeA, uow));

      const edgeB = ElementFactory.edge({
        start: new FreeEndpoint({ x: 0, y: 50 }),
        end: new PointOnEdgeEndpoint(edgeA, 0.5),
        layer
      });
      UnitOfWork.execute(diagram, uow => {
        layer.addElement(edgeB, uow);
        edgeB.setEnd(new PointOnEdgeEndpoint(edgeA, 0.5), uow);
      });

      // edgeA -> edgeB would close the cycle A -> B -> A
      expect(() =>
        UnitOfWork.execute(diagram, uow => edgeA.setStart(new PointOnEdgeEndpoint(edgeB, 0.5), uow))
      ).toThrow();
    });
  });

  describe('attachedEdges', () => {
    it('tracks edges attached via PointOnEdgeEndpoint and updates on reconnect', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const target = ElementFactory.edge({
        start: new FreeEndpoint({ x: 0, y: 0 }),
        end: new FreeEndpoint({ x: 100, y: 0 }),
        layer
      });
      UnitOfWork.execute(diagram, uow => layer.addElement(target, uow));

      const referencing = layer.addEdge();
      UnitOfWork.execute(diagram, uow =>
        referencing.setStart(new PointOnEdgeEndpoint(target, 0.5), uow)
      );

      expect(target.attachedEdges.map(e => e.id)).toContain(referencing.id);

      UnitOfWork.execute(diagram, uow =>
        referencing.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow)
      );

      expect(target.attachedEdges.map(e => e.id)).not.toContain(referencing.id);
    });
  });

  describe('isTransitivelyAttachedTo', () => {
    it('returns true for self', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      expect(edge.isTransitivelyAttachedTo(edge)).toBe(true);
    });

    it('returns true across a chain of edge-to-edge attachments', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const edgeA = ElementFactory.edge({
        start: new FreeEndpoint({ x: 0, y: 0 }),
        end: new FreeEndpoint({ x: 100, y: 0 }),
        layer
      });
      UnitOfWork.execute(diagram, uow => layer.addElement(edgeA, uow));

      const edgeB = layer.addEdge();
      UnitOfWork.execute(diagram, uow => edgeB.setEnd(new PointOnEdgeEndpoint(edgeA, 0.5), uow));

      const edgeC = layer.addEdge();
      UnitOfWork.execute(diagram, uow => edgeC.setEnd(new PointOnEdgeEndpoint(edgeB, 0.5), uow));

      expect(edgeC.isTransitivelyAttachedTo(edgeA)).toBe(true);
      expect(edgeA.isTransitivelyAttachedTo(edgeC)).toBe(false);
    });
  });

  describe('flip', () => {
    it('swaps start and end', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();
      UnitOfWork.execute(diagram, uow => {
        edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
        edge.setEnd(new FreeEndpoint({ x: 10, y: 10 }), uow);
      });

      UnitOfWork.execute(diagram, uow => edge.flip(uow));

      expect(edge.start.position).toEqual({ x: 10, y: 10 });
      expect(edge.end.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('reattach', () => {
    it('restores attachedEdges bookkeeping after undo when the referenced edge is restored later', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const edgeA = ElementFactory.edge({
        start: new FreeEndpoint({ x: 0, y: 0 }),
        end: new FreeEndpoint({ x: 100, y: 0 }),
        layer
      });
      UnitOfWork.execute(diagram, uow => layer.addElement(edgeA, uow));

      const edgeB = layer.addEdge();
      UnitOfWork.execute(diagram, uow => edgeB.setEnd(new PointOnEdgeEndpoint(edgeA, 0.5), uow));

      expect(edgeA.attachedEdges.map(e => e.id)).toContain(edgeB.id);

      diagram.undoManager.execute('remove', uow => {
        layer.removeElement(edgeA, uow);
        layer.removeElement(edgeB, uow);
      });

      diagram.undoManager.undo();

      const restoredA = diagram.edgeLookup.get(edgeA.id)!;
      expect(restoredA.attachedEdges.map(e => e.id)).toContain(edgeB.id);
    });
  });
});
