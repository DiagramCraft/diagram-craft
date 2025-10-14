import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import {
  Backends,
  type StandardTestModel,
  standardTestModel
} from './collaboration/collaborationTestUtils';
import type { DiagramNode } from './diagramNode';
import { ModificationLayer } from './diagramLayerModification';
import { DelegatingDiagramNode } from './delegatingDiagramNode';

describe.each(Backends.all())('DelegatingDiagramElement [%s]', (_name, backend) => {
  let model: StandardTestModel;
  let baseNode: DiagramNode;
  let baseNode2: DiagramNode | undefined;
  let modLayer: ModificationLayer;
  let modLayer2: ModificationLayer | undefined;
  let delegatingNode: DelegatingDiagramNode;
  let delegatingNode2: DelegatingDiagramNode | undefined;

  beforeEach(() => {
    backend.beforeEach();
    model = standardTestModel(backend);

    // Create a regular node to delegate to
    baseNode = model.layer1.addNode({
      id: 'd-1',
      bounds: { x: 10, y: 20, w: 50, h: 40, r: 0 }
    });

    // Find the delegate node in diagram2 if it exists
    baseNode2 = model.diagram2?.lookup(baseNode.id) as DiagramNode | undefined;

    // Create a modification layer and add it to the diagram
    modLayer = new ModificationLayer('mod', 'Modification', model.diagram1, []);
    model.diagram1.layers.add(modLayer, UnitOfWork.immediate(model.diagram1));

    model.diagram1.layers.active = model.layer1;

    // Find the modification layer in diagram2 if it exists
    if (model.diagram2) {
      modLayer2 = model.diagram2.layers.byId('mod-layer-1') as ModificationLayer;
    }

    // Create a delegating node by modifying the delegate
    delegatingNode = new DelegatingDiagramNode(`do-${baseNode.id}`, baseNode, modLayer);
    modLayer.modifyChange(baseNode.id, delegatingNode, UnitOfWork.immediate(model.diagram1));

    if (modLayer2) {
      delegatingNode2 = modLayer2.elements.find(
        e => e.id === `do-${baseNode.id}`
      ) as DelegatingDiagramNode;
    }
  });

  afterEach(backend.afterEach);

  describe('metadata', () => {
    it('should return delegate metadata when no override is set', () => {
      // Setup - set some metadata on the delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseNode.updateMetadata(metadata => {
          metadata.data = { customData: { foo: 'bar' } };
        }, uow)
      );

      // Verify
      expect(delegatingNode.metadata.data?.customData).toEqual({ foo: 'bar' });
      expect(delegatingNode.metadata).toMatchObject(baseNode.metadata);

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({ foo: 'bar' });
      }
    });

    it('should merge delegate metadata with overridden metadata', () => {
      // Setup - set metadata on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseNode.updateMetadata(metadata => {
          metadata.data = { customData: { delegateKey: 'delegateValue' } };
        }, uow)
      );

      // Act - override some metadata on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { overrideKey: 'overrideValue' } };
        }, uow)
      );

      // Verify - should have both delegate and override metadata
      expect(delegatingNode.metadata.data?.customData).toEqual({
        delegateKey: 'delegateValue',
        overrideKey: 'overrideValue'
      });
      expect(baseNode.metadata.data?.customData).toEqual({ delegateKey: 'delegateValue' });

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({
          delegateKey: 'delegateValue',
          overrideKey: 'overrideValue'
        });
        expect(baseNode2.metadata.data?.customData).toEqual({ delegateKey: 'delegateValue' });
      }
    });

    it('should override delegate metadata keys with same name', () => {
      // Setup - set metadata on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseNode.updateMetadata(metadata => {
          metadata.data = { customData: { key: 'delegateValue' } };
        }, uow)
      );

      // Act - override the same key on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { key: 'overrideValue' } };
        }, uow)
      );

      // Verify - override should win
      expect(delegatingNode.metadata.data?.customData).toEqual({ key: 'overrideValue' });
      expect(baseNode.metadata.data?.customData).toEqual({ key: 'delegateValue' });

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({ key: 'overrideValue' });
        expect(baseNode2.metadata.data?.customData).toEqual({ key: 'delegateValue' });
      }
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = {
            customData: { testKey: 'testValue' }
          };
        }, uow)
      );

      // Verify
      expect(delegatingNode.metadata.data?.customData?.testKey).toBe('testValue');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.metadata.data?.customData?.testKey).toBe('testValue');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate metadata', () => {
      // Setup - set delegate metadata
      UnitOfWork.execute(model.diagram1, uow =>
        baseNode.updateMetadata(metadata => {
          metadata.data = { customData: { delegateKey: 'delegateValue' } };
        }, uow)
      );

      const originalDelegateMetadata = { ...baseNode.metadata };

      // Act - update delegating node metadata
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { overrideKey: 'overrideValue' } };
        }, uow)
      );

      // Verify - delegate metadata should remain unchanged
      expect(delegatingNode.metadata.data?.customData).toEqual({
        delegateKey: 'delegateValue',
        overrideKey: 'overrideValue'
      });
      expect(baseNode.metadata.data?.customData).toEqual(originalDelegateMetadata.data?.customData);

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({
          delegateKey: 'delegateValue',
          overrideKey: 'overrideValue'
        });
        expect(baseNode2.metadata.data?.customData).toEqual(
          originalDelegateMetadata.data?.customData
        );
      }
    });
  });
});
