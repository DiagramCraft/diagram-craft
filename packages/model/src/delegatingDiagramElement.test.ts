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
  let delegateNode: DiagramNode;
  let delegateNode2: DiagramNode | undefined;
  let modificationLayer: ModificationLayer;
  let modificationLayer2: ModificationLayer | undefined;
  let delegatingNode: DelegatingDiagramNode;
  let delegatingNode2: DelegatingDiagramNode | undefined;

  beforeEach(() => {
    backend.beforeEach();
    model = standardTestModel(backend);

    // Create a regular node to delegate to
    delegateNode = model.layer1.addNode({
      id: 'delegate-node-1',
      bounds: { x: 10, y: 20, w: 50, h: 40, r: 0 }
    });

    // Find the delegate node in diagram2 if it exists
    delegateNode2 = model.diagram2?.lookup(delegateNode.id) as DiagramNode | undefined;

    // Create a modification layer and add it to the diagram
    modificationLayer = new ModificationLayer(
      'mod-layer-1',
      'Modification Layer',
      model.diagram1,
      []
    );
    model.diagram1.layers.add(modificationLayer, UnitOfWork.immediate(model.diagram1));

    model.diagram1.layers.active = model.layer1;

    // Find the modification layer in diagram2 if it exists
    if (model.diagram2) {
      modificationLayer2 = model.diagram2.layers.byId('mod-layer-1') as
        | ModificationLayer
        | undefined;
    }

    // Create a delegating node by modifying the delegate
    const delegatingNodeInstance = new DelegatingDiagramNode(
      'delegating-node-override-' + delegateNode.id,
      delegateNode,
      modificationLayer
    );
    modificationLayer.modifyChange(
      delegateNode.id,
      delegatingNodeInstance,
      UnitOfWork.immediate(model.diagram1)
    );

    // Get reference to the delegating nodes
    delegatingNode = modificationLayer.elements.find(
      e => e.id === 'delegating-node-override-' + delegateNode.id
    ) as DelegatingDiagramNode;

    if (modificationLayer2) {
      delegatingNode2 = modificationLayer2.elements.find(
        e => e.id === 'delegating-node-override-' + delegateNode.id
      ) as DelegatingDiagramNode | undefined;
    }
  });

  afterEach(backend.afterEach);

  describe('metadata', () => {
    it('should return delegate metadata when no override is set', () => {
      // Setup - set some metadata on the delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
          metadata.data = { customData: { foo: 'bar' } };
        }, uow)
      );

      // Verify
      expect(delegatingNode.metadata.data?.customData).toEqual({ foo: 'bar' });
      expect(delegatingNode.metadata).toMatchObject(delegateNode.metadata);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({ foo: 'bar' });
      }
    });

    it('should merge delegate metadata with overridden metadata', () => {
      // Setup - set metadata on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
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
      expect(delegateNode.metadata.data?.customData).toEqual({ delegateKey: 'delegateValue' });

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({
          delegateKey: 'delegateValue',
          overrideKey: 'overrideValue'
        });
        expect(delegateNode2.metadata.data?.customData).toEqual({ delegateKey: 'delegateValue' });
      }
    });

    it('should override delegate metadata keys with same name', () => {
      // Setup - set metadata on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
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
      expect(delegateNode.metadata.data?.customData).toEqual({ key: 'delegateValue' });

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({ key: 'overrideValue' });
        expect(delegateNode2.metadata.data?.customData).toEqual({ key: 'delegateValue' });
      }
    });

    it('should persist overridden metadata after delegate changes', () => {
      // Setup - override metadata
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { overrideKey: 'overrideValue' } };
        }, uow)
      );

      // Act - change delegate metadata
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
          metadata.data = { customData: { delegateKey: 'newDelegateValue' } };
        }, uow)
      );

      // Verify - delegating node should keep overridden metadata and merge with new delegate metadata
      expect(delegatingNode.metadata.data?.customData).toEqual({
        delegateKey: 'newDelegateValue',
        overrideKey: 'overrideValue'
      });
      expect(delegateNode.metadata.data?.customData).toEqual({
        delegateKey: 'newDelegateValue'
      });

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({
          delegateKey: 'newDelegateValue',
          overrideKey: 'overrideValue'
        });
      }
    });

    it('should merge data arrays from delegate and override', () => {
      // Setup - set data array on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
          metadata.data = {
            data: [
              { schema: 'test', type: 'schema', data: { field1: 'value1' }, enabled: true },
              { schema: 'test', type: 'schema', data: { field2: 'value2' }, enabled: true }
            ]
          };
        }, uow)
      );

      // Act - add data array on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = {
            data: [
              { schema: 'test', type: 'schema', data: { field3: 'value3' }, enabled: true },
              { schema: 'test', type: 'schema', data: { field4: 'value4' }, enabled: true }
            ]
          };
        }, uow)
      );

      // Verify - should concatenate both arrays (though CRDT may convert to objects)
      const mergedData = delegatingNode.metadata.data?.data;
      expect(mergedData).toBeDefined();
      expect(mergedData?.length).toBe(4);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        const mergedData2 = delegatingNode2.metadata.data?.data;
        expect(mergedData2).toBeDefined();
        expect(mergedData2?.length).toBe(4);
      }
    });

    it('should handle multiple customData keys', () => {
      // Setup - set customData on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
          metadata.data = {
            customData: {
              delegateKey1: 'delegateValue1',
              delegateKey2: 42,
              sharedKey: 'delegateShared'
            }
          };
        }, uow)
      );

      // Act - override some customData on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = {
            customData: {
              overrideKey1: 'overrideValue1',
              sharedKey: 'overrideShared'
            }
          };
        }, uow)
      );

      // Verify - should merge customData keys
      expect(delegatingNode.metadata.data?.customData?.delegateKey1).toBe('delegateValue1');
      expect(delegatingNode.metadata.data?.customData?.delegateKey2).toBe(42);
      expect(delegatingNode.metadata.data?.customData?.overrideKey1).toBe('overrideValue1');
      expect(delegatingNode.metadata.data?.customData?.sharedKey).toBe('overrideShared');

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.metadata.data?.customData?.delegateKey1).toBe('delegateValue1');
        expect(delegatingNode2.metadata.data?.customData?.overrideKey1).toBe('overrideValue1');
        expect(delegatingNode2.metadata.data?.customData?.sharedKey).toBe('overrideShared');
      }
    });
  });

  describe('metadataCloned', () => {
    it('should return a deep clone of metadata', () => {
      // Setup
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { key: 'value' } };
        }, uow)
      );

      // Act
      const cloned = delegatingNode.metadataCloned;
      cloned.data!.customData!.key = 'modified';

      // Verify - original should not be affected
      expect(delegatingNode.metadata.data?.customData?.key).toBe('value');
      expect(cloned.data?.customData?.key).toBe('modified');
    });

    it('should clone merged metadata from delegate and override', () => {
      // Setup
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateMetadata(metadata => {
          metadata.data = { customData: { delegateKey: 'delegateValue' } };
        }, uow)
      );

      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { overrideKey: 'overrideValue' } };
        }, uow)
      );

      // Act
      const cloned = delegatingNode.metadataCloned;
      cloned.data!.customData!.overrideKey = 'modified';

      // Verify - original merged metadata should not be affected
      expect(delegatingNode.metadata.data?.customData).toEqual({
        delegateKey: 'delegateValue',
        overrideKey: 'overrideValue'
      });
      expect(cloned.data?.customData).toEqual({
        delegateKey: 'delegateValue',
        overrideKey: 'modified'
      });
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
        delegateNode.updateMetadata(metadata => {
          metadata.data = { customData: { delegateKey: 'delegateValue' } };
        }, uow)
      );

      const originalDelegateMetadata = { ...delegateNode.metadata };

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
      expect(delegateNode.metadata.data?.customData).toEqual(
        originalDelegateMetadata.data?.customData
      );

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.metadata.data?.customData).toEqual({
          delegateKey: 'delegateValue',
          overrideKey: 'overrideValue'
        });
        expect(delegateNode2.metadata.data?.customData).toEqual(
          originalDelegateMetadata.data?.customData
        );
      }
    });

    it('should update element in unit of work', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingNode.updateMetadata(metadata => {
        metadata.data = { customData: { key: 'value' } };
      }, uow);

      // Verify
      expect(delegatingNode.metadata.data?.customData?.key).toBe('value');
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should allow multiple metadata updates with CRDT sync', () => {
      // Act - first update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { key1: 'value1' } };
        }, uow)
      );
      expect(delegatingNode.metadata.data?.customData?.key1).toBe('value1');
      if (delegatingNode2) expect(delegatingNode2.metadata.data?.customData?.key1).toBe('value1');

      // Act - second update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { key2: 'value2' } };
        }, uow)
      );
      expect(delegatingNode.metadata.data?.customData?.key2).toBe('value2');
      if (delegatingNode2) expect(delegatingNode2.metadata.data?.customData?.key2).toBe('value2');

      // Act - third update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { key3: 'value3' } };
        }, uow)
      );
      expect(delegatingNode.metadata.data?.customData?.key3).toBe('value3');
      if (delegatingNode2) expect(delegatingNode2.metadata.data?.customData?.key3).toBe('value3');
    });

    it('should create snapshot when updating metadata', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingNode.updateMetadata(metadata => {
        metadata.data = { customData: { snapshotTest: 'value' } };
      }, uow);

      // Verify
      expect(delegatingNode.metadata.data?.customData?.snapshotTest).toBe('value');
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should handle empty metadata updates', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = {};
        }, uow)
      );

      // Verify
      expect(delegatingNode.metadata.data).toEqual({
        customData: {},
        data: []
      });

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.metadata.data).toEqual({
          customData: {},
          data: []
        });
      }
    });

    it('should handle undefined metadata values', () => {
      // Setup - first set some metadata
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = { customData: { key: 'value' } };
        }, uow)
      );

      // Act - clear it
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = undefined;
        }, uow)
      );

      // Verify
      expect(delegatingNode.metadata.data).toEqual({
        customData: {},
        data: []
      });

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.metadata.data).toEqual({
          customData: {},
          data: []
        });
      }
    });

    it('should handle various primitive types in customData', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateMetadata(metadata => {
          metadata.data = {
            customData: {
              stringKey: 'stringValue',
              numberKey: 123,
              booleanKey: true
            }
          };
        }, uow)
      );

      // Verify
      expect(delegatingNode.metadata.data?.customData?.stringKey).toBe('stringValue');
      expect(delegatingNode.metadata.data?.customData?.numberKey).toBe(123);
      expect(delegatingNode.metadata.data?.customData?.booleanKey).toBe(true);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.metadata.data?.customData?.stringKey).toBe('stringValue');
        expect(delegatingNode2.metadata.data?.customData?.numberKey).toBe(123);
        expect(delegatingNode2.metadata.data?.customData?.booleanKey).toBe(true);
      }
    });
  });
});
