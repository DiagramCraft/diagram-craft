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
import { Box } from '@diagram-craft/geometry/box';

describe.each(Backends.all())('DelegatingDiagramNode [%s]', (_name, backend) => {
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
      id: 'delegate-node-1',
      bounds: { x: 10, y: 20, w: 50, h: 40, r: 0 }
    });

    // Find the delegate node in diagram2 if it exists
    baseNode2 = model.diagram2?.lookup(baseNode.id) as DiagramNode;

    // Create a modification layer and add it to the diagram
    modLayer = new ModificationLayer('mod-layer-1', 'Modification Layer', model.diagram1, []);
    model.diagram1.layers.add(modLayer, UnitOfWork.immediate(model.diagram1));

    model.diagram1.layers.active = model.layer1;

    // Find the modification layer in diagram2 if it exists
    if (model.diagram2) {
      modLayer2 = model.diagram2.layers.byId('mod-layer-1') as ModificationLayer;
    }

    // Create a delegating node by modifying the delegate
    delegatingNode = new DelegatingDiagramNode(
      'delegating-node-override-' + baseNode.id,
      baseNode,
      modLayer
    );
    modLayer.modifyChange(baseNode.id, delegatingNode, UnitOfWork.immediate(model.diagram1));

    if (modLayer2) {
      delegatingNode2 = modLayer2.elements.find(
        e => e.id === 'delegating-node-override-' + baseNode.id
      ) as DelegatingDiagramNode;
    }
  });

  afterEach(backend.afterEach);

  describe('bounds', () => {
    it('should return delegate bounds when no override is set', () => {
      // Verify
      expect(delegatingNode.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });
      expect(delegatingNode.bounds).toEqual(baseNode.bounds);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2).toBeInstanceOf(DelegatingDiagramNode);
        expect(delegatingNode2.bounds).toEqual(baseNode2!.bounds);
      }
    });

    it('should return delegate bounds after delegate changes', () => {
      // Act - change the delegate node bounds
      const newBounds = { x: 100, y: 200, w: 150, h: 140, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => baseNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);

      // Verify CRDT sync
      if (delegatingNode2) expect(delegatingNode2.bounds).toEqual(newBounds);
    });

    it('should return overridden bounds when set', () => {
      // Act - set overridden bounds on the delegating node
      const newBounds: Box = { x: 30, y: 40, w: 60, h: 70, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);
      expect(baseNode.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.bounds).toEqual(newBounds);
        expect(baseNode2!.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });
      }
    });
  });

  describe('setBounds', () => {
    it('should set bounds correctly and sync via CRDT', () => {
      // Setup
      model.reset();
      const newBounds: Box = { x: 25, y: 35, w: 80, h: 90, r: 0 };

      // Act
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.bounds).toEqual(newBounds);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate bounds', () => {
      // Setup
      const originalDelegateBounds = { ...baseNode.bounds };
      const newBounds: Box = { x: 999, y: 888, w: 777, h: 666, r: 0 };

      // Act
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);
      expect(baseNode.bounds).toEqual(originalDelegateBounds);

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.bounds).toEqual(newBounds);
        expect(baseNode2.bounds).toEqual(originalDelegateBounds);
      }
    });
  });

  describe('storedProps', () => {
    it('should return delegate props when no override is set', () => {
      // Setup - set some props on the delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseNode.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );

      // Verify
      expect(delegatingNode.storedProps.stroke?.color).toBe('blue');
      expect(delegatingNode.storedProps.stroke?.width).toBe(2);

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('blue');
        expect(delegatingNode2.storedProps.stroke?.width).toBe(2);
      }
    });

    it('should merge delegate props with overridden props', () => {
      // Setup - set props on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseNode.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
          props.fill = { color: 'green' };
        }, uow)
      );

      // Act - override some props on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'red', width: 3 };
        }, uow)
      );

      // Verify - should have overridden stroke but delegate fill
      expect(delegatingNode.storedProps.stroke?.color).toBe('red');
      expect(delegatingNode.storedProps.stroke?.width).toBe(3);
      expect(delegatingNode.storedProps.fill?.color).toBe('green');
      expect(baseNode.storedProps.stroke?.color).toBe('blue');

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('red');
        expect(delegatingNode2.storedProps.stroke?.width).toBe(3);
        expect(delegatingNode2.storedProps.fill?.color).toBe('green');
        expect(baseNode2.storedProps.stroke?.color).toBe('blue');
      }
    });
  });

  describe('updateProps', () => {
    it('should update props and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'orange', width: 4 };
          props.fill = { color: 'cyan' };
        }, uow)
      );

      // Verify
      expect(delegatingNode.storedProps.stroke?.color).toBe('orange');
      expect(delegatingNode.storedProps.fill?.color).toBe('cyan');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('orange');
        expect(delegatingNode2.storedProps.fill?.color).toBe('cyan');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('updateCustomProps', () => {
    it('should update custom props and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateCustomProps(
          'star',
          props => {
            props.numberOfSides = 7;
          },
          uow
        )
      );

      // Verify
      expect(delegatingNode.storedProps.custom?.star?.numberOfSides).toBe(7);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.storedProps.custom?.star?.numberOfSides).toBe(7);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('getText', () => {
    it('should return delegate text when no override is set', () => {
      // Setup - set text on delegate
      UnitOfWork.execute(model.diagram1, uow => baseNode.setText('Delegate Text', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('Delegate Text');
      expect(delegatingNode.getText()).toBe(baseNode.getText());

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.getText()).toBe('Delegate Text');
      }
    });

    it('should return overridden text when set', () => {
      // Setup - set text on delegate
      UnitOfWork.execute(model.diagram1, uow => baseNode.setText('Delegate Text', uow));

      // Act - override text on delegating node
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Override Text', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('Override Text');
      expect(baseNode.getText()).toBe('Delegate Text');

      // Verify CRDT sync
      if (delegatingNode2 && baseNode2) {
        expect(delegatingNode2.getText()).toBe('Override Text');
        expect(baseNode2.getText()).toBe('Delegate Text');
      }
    });
  });

  describe('setText', () => {
    it('should set text correctly and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('New Text', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('New Text');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.getText()).toBe('New Text');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });
});
