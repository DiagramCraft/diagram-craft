import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestDiagramBuilder, TestLayerBuilder, TestModel } from './test-support/testModel';
import { FreeEndpoint } from './endpoint';
import { UnitOfWork } from './unitOfWork';
import { AbstractEdgeDefinition } from './edgeDefinition';
import { RegularLayer } from './diagramLayerRegular';
import { SnapshotUndoableAction } from './diagramUndoActions';
import type { DiagramEdge } from './diagramEdge';
import type { DiagramDocument } from './diagramDocument';
import type { DiagramNode } from './diagramNode';
import { serializeDiagramDocument } from './serialization/serialize';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

class TestBaseEdgeDefinition extends AbstractEdgeDefinition {
  constructor(
    public readonly name: string,
    public readonly description: string
  ) {
    super(name, description);
  }
}

describe('baseEdgeDefinition', () => {
  describe.each(Backends.all())('onDrop [%s]', (_name, backend) => {
    beforeEach(backend.beforeEach);
    afterEach(backend.afterEach);

    describe('onDropSplit', () => {
      let dia1: TestDiagramBuilder;
      let doc2: DiagramDocument | undefined;
      let layer1: TestLayerBuilder;
      let layer1_2: RegularLayer | undefined;
      let node: DiagramNode;
      let edge: DiagramEdge;

      beforeEach(() => {
        const [root1, root2] = backend.syncedDocs();

        dia1 = TestModel.newDiagram(root1);
        doc2 = root2 ? TestModel.newDocument(root2) : undefined;
        layer1 = dia1.newLayer('layer');
        layer1_2 = doc2 ? (doc2.diagrams[0]!.layers.all[0] as RegularLayer) : undefined;

        UnitOfWork.execute(dia1, uow => {
          node = layer1.addNode({ bounds: { x: 40, y: 40, w: 20, h: 20, r: 0 } });

          edge = layer1.addEdge();
          edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
          edge.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
        });
      });

      it('should split edge', () => {
        // **** Setup
        const def = new TestBaseEdgeDefinition('test', 'test');

        // **** Act
        const uow = new UnitOfWork(dia1, true);
        def.onDrop({ x: 50, y: 50 }, edge, [node], uow, 'split');

        const snapshots = uow.commit();
        dia1.undoManager.add(new SnapshotUndoableAction('Split', dia1, snapshots.onlyUpdated()));

        // **** Verify
        expect(layer1.elements).toHaveLength(3);
        if (doc2) expect(layer1_2!.elements).toHaveLength(3);
      });

      it('should undo', async () => {
        // **** Setup
        const doc1serialized = await serializeDiagramDocument(dia1.document);
        const doc2serialized = doc2 ? await serializeDiagramDocument(doc2) : undefined;

        const def = new TestBaseEdgeDefinition('test', 'test');

        const uow = new UnitOfWork(dia1, true);
        def.onDrop({ x: 50, y: 50 }, edge, [node], uow, 'split');

        const snapshots = uow.commit();
        dia1.undoManager.add(new SnapshotUndoableAction('Split', dia1, snapshots.onlyUpdated()));

        // **** Act
        dia1.undoManager.undo();

        // **** Verify
        expect(await serializeDiagramDocument(dia1.document)).toStrictEqual(doc1serialized);
        if (doc2) {
          expect(await serializeDiagramDocument(doc2)).toStrictEqual(doc2serialized);
        }
      });
    });
  });
});
