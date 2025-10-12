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

  describe('bounds', () => {
    it('should return delegate bounds when no override is set', () => {
      // Verify
      expect(delegatingNode.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });
      expect(delegatingNode.bounds).toEqual(delegateNode.bounds);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2).toBeInstanceOf(DelegatingDiagramNode);
        expect(delegatingNode2.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });
        expect(delegatingNode2.bounds).toEqual(delegateNode2!.bounds);
      }
    });

    it('should return delegate bounds after delegate changes', () => {
      // Act - change the delegate node bounds
      const newBounds = { x: 100, y: 200, w: 150, h: 140, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegateNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);
      expect(delegatingNode.bounds).toEqual(delegateNode.bounds);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.bounds).toEqual(newBounds);
        expect(delegatingNode2.bounds).toEqual(delegateNode2.bounds);
      }
    });

    it('should return overridden bounds when set', () => {
      // Act - set overridden bounds on the delegating node
      const newBounds: Box = { x: 30, y: 40, w: 60, h: 70, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);
      expect(delegatingNode.bounds).not.toEqual(delegateNode.bounds);
      expect(delegateNode.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2).toBeInstanceOf(DelegatingDiagramNode);
        expect(delegatingNode2.bounds).toEqual(newBounds);
        expect(delegatingNode2.bounds).not.toEqual(delegateNode2!.bounds);
        expect(delegateNode2!.bounds).toEqual({ x: 10, y: 20, w: 50, h: 40, r: 0 });
      }
    });

    it('should persist overridden bounds after delegate changes', () => {
      // Setup - set overridden bounds
      const overriddenBounds: Box = { x: 30, y: 40, w: 60, h: 70, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(overriddenBounds, uow));

      // Act - change delegate bounds
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.setBounds({ x: 100, y: 200, w: 150, h: 140, r: 0 }, uow)
      );

      // Verify - delegating node should still have overridden bounds
      expect(delegatingNode.bounds).toEqual(overriddenBounds);
      expect(delegateNode.bounds).toEqual({ x: 100, y: 200, w: 150, h: 140, r: 0 });

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.bounds).toEqual(overriddenBounds);
        expect(delegateNode2.bounds).toEqual({ x: 100, y: 200, w: 150, h: 140, r: 0 });
      }
    });

    it('should handle bounds with rotation', () => {
      // Act
      const boundsWithRotation: Box = { x: 10, y: 20, w: 50, h: 40, r: Math.PI / 4 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(boundsWithRotation, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(boundsWithRotation);
      expect(delegatingNode.bounds.r).toBe(Math.PI / 4);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.bounds).toEqual(boundsWithRotation);
        expect(delegatingNode2.bounds.r).toBe(Math.PI / 4);
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

    it('should update element in unit of work', () => {
      // Setup
      const newBounds: Box = { x: 100, y: 100, w: 200, h: 200, r: 0 };

      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingNode.setBounds(newBounds, uow);

      // Verify the bounds changed
      expect(delegatingNode.bounds).toEqual(newBounds);

      // Verify element was updated in the uow
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should allow setting bounds multiple times with CRDT sync', () => {
      // Act
      const bounds1: Box = { x: 1, y: 2, w: 3, h: 4, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(bounds1, uow));
      expect(delegatingNode.bounds).toEqual(bounds1);
      if (delegatingNode2) expect(delegatingNode2.bounds).toEqual(bounds1);

      const bounds2: Box = { x: 10, y: 20, w: 30, h: 40, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(bounds2, uow));
      expect(delegatingNode.bounds).toEqual(bounds2);
      if (delegatingNode2) expect(delegatingNode2.bounds).toEqual(bounds2);

      const bounds3: Box = { x: 100, y: 200, w: 300, h: 400, r: Math.PI / 2 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(bounds3, uow));
      expect(delegatingNode.bounds).toEqual(bounds3);
      if (delegatingNode2) expect(delegatingNode2.bounds).toEqual(bounds3);
    });

    it('should not affect delegate bounds', () => {
      // Setup
      const originalDelegateBounds = { ...delegateNode.bounds };
      const newBounds: Box = { x: 999, y: 888, w: 777, h: 666, r: 0 };

      // Act
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(newBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(newBounds);
      expect(delegateNode.bounds).toEqual(originalDelegateBounds);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.bounds).toEqual(newBounds);
        expect(delegateNode2.bounds).toEqual(originalDelegateBounds);
      }
    });

    it('should handle zero-sized bounds', () => {
      // Act
      const zeroBounds: Box = { x: 10, y: 10, w: 0, h: 0, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(zeroBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(zeroBounds);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.bounds).toEqual(zeroBounds);
      }
    });

    it('should handle negative coordinates', () => {
      // Act
      const negativeBounds: Box = { x: -50, y: -100, w: 75, h: 125, r: 0 };
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setBounds(negativeBounds, uow));

      // Verify
      expect(delegatingNode.bounds).toEqual(negativeBounds);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.bounds).toEqual(negativeBounds);
      }
    });

    it('should handle large rotation values', () => {
      // Act
      const boundsWithLargeRotation: Box = { x: 10, y: 20, w: 30, h: 40, r: Math.PI * 3 };
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.setBounds(boundsWithLargeRotation, uow)
      );

      // Verify
      expect(delegatingNode.bounds).toEqual(boundsWithLargeRotation);
      expect(delegatingNode.bounds.r).toBe(Math.PI * 3);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.bounds).toEqual(boundsWithLargeRotation);
        expect(delegatingNode2.bounds.r).toBe(Math.PI * 3);
      }
    });

    it('should create snapshot when setting bounds', () => {
      // Setup
      const newBounds: Box = { x: 100, y: 100, w: 200, h: 200, r: 0 };

      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingNode.setBounds(newBounds, uow);

      // Verify the bounds changed
      expect(delegatingNode.bounds).toEqual(newBounds);

      // Verify snapshot was created (element should be in the update set)
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });
  });

  describe('storedProps', () => {
    it('should return delegate props when no override is set', () => {
      // Setup - set some props on the delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );

      // Verify
      expect(delegatingNode.storedProps.stroke?.color).toBe('blue');
      expect(delegatingNode.storedProps.stroke?.width).toBe(2);
      expect(delegatingNode.storedProps).toMatchObject(delegateNode.storedProps);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('blue');
        expect(delegatingNode2.storedProps.stroke?.width).toBe(2);
      }
    });

    it('should merge delegate props with overridden props', () => {
      // Setup - set props on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateProps(props => {
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
      expect(delegateNode.storedProps.stroke?.color).toBe('blue');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('red');
        expect(delegatingNode2.storedProps.stroke?.width).toBe(3);
        expect(delegatingNode2.storedProps.fill?.color).toBe('green');
        expect(delegateNode2.storedProps.stroke?.color).toBe('blue');
      }
    });

    it('should persist overridden props after delegate changes', () => {
      // Setup - override props
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'red', width: 5 };
        }, uow)
      );

      // Act - change delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateProps(props => {
          props.stroke = { color: 'yellow', width: 1 };
        }, uow)
      );

      // Verify - delegating node should keep overridden props
      expect(delegatingNode.storedProps.stroke?.color).toBe('red');
      expect(delegatingNode.storedProps.stroke?.width).toBe(5);
      expect(delegateNode.storedProps.stroke?.color).toBe('yellow');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('red');
        expect(delegateNode2.storedProps.stroke?.color).toBe('yellow');
      }
    });
  });

  describe('storedPropsCloned', () => {
    it('should return a deep clone of stored props', () => {
      // Setup
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );

      // Act
      const cloned = delegatingNode.storedPropsCloned;
      cloned.stroke!.color = 'modified';

      // Verify - original should not be affected
      expect(delegatingNode.storedProps.stroke?.color).toBe('blue');
      expect(cloned.stroke?.color).toBe('modified');
    });
  });

  describe('editProps', () => {
    it('should return merged props for editing', () => {
      // Setup - set delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateProps(props => {
          props.fill = { color: 'blue' };
        }, uow)
      );

      // Act - override on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'red', width: 2 };
        }, uow)
      );

      // Verify
      expect(delegatingNode.editProps.stroke?.color).toBe('red');
      expect(delegatingNode.editProps.fill?.color).toBe('blue');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.editProps.stroke?.color).toBe('red');
        expect(delegatingNode2.editProps.fill?.color).toBe('blue');
      }
    });
  });

  describe('renderProps', () => {
    it('should return merged props for rendering', () => {
      // Setup - set delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateProps(props => {
          props.fill = { color: 'green' };
        }, uow)
      );

      // Act - override on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'purple', width: 3 };
        }, uow)
      );

      // Verify
      expect(delegatingNode.renderProps.stroke?.color).toBe('purple');
      expect(delegatingNode.renderProps.fill?.color).toBe('green');
      expect(delegatingNode.props.stroke?.color).toBe('purple'); // props is alias for renderProps

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.renderProps.stroke?.color).toBe('purple');
        expect(delegatingNode2.renderProps.fill?.color).toBe('green');
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

    it('should not affect delegate props', () => {
      // Setup - set delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateProps(props => {
          props.stroke = { color: 'black', width: 1 };
        }, uow)
      );

      const originalDelegateColor = delegateNode.storedProps.stroke?.color;

      // Act - update delegating node props
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'white', width: 5 };
        }, uow)
      );

      // Verify
      expect(delegatingNode.storedProps.stroke?.color).toBe('white');
      expect(delegateNode.storedProps.stroke?.color).toBe(originalDelegateColor);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.storedProps.stroke?.color).toBe('white');
        expect(delegateNode2.storedProps.stroke?.color).toBe(originalDelegateColor);
      }
    });

    it('should update element in unit of work', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingNode.updateProps(props => {
        props.fill = { color: 'magenta' };
      }, uow);

      // Verify
      expect(delegatingNode.storedProps.fill?.color).toBe('magenta');
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should allow multiple prop updates with CRDT sync', () => {
      // Act - first update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'red', width: 1 };
        }, uow)
      );
      expect(delegatingNode.storedProps.stroke?.color).toBe('red');
      if (delegatingNode2) expect(delegatingNode2.storedProps.stroke?.color).toBe('red');

      // Act - second update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );
      expect(delegatingNode.storedProps.stroke?.color).toBe('blue');
      if (delegatingNode2) expect(delegatingNode2.storedProps.stroke?.color).toBe('blue');

      // Act - third update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.fill = { color: 'yellow' };
        }, uow)
      );
      expect(delegatingNode.storedProps.fill?.color).toBe('yellow');
      if (delegatingNode2) expect(delegatingNode2.storedProps.fill?.color).toBe('yellow');
    });

    it('should create snapshot when updating props', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingNode.updateProps(props => {
        props.stroke = { color: 'green', width: 3 };
      }, uow);

      // Verify
      expect(delegatingNode.storedProps.stroke?.color).toBe('green');
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should handle deep property updates', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateProps(props => {
          props.stroke = { color: 'blue', width: 2, pattern: 'dashed' };
          props.fill = { color: 'red' };
        }, uow)
      );

      // Verify
      expect(delegatingNode.storedProps.stroke?.color).toBe('blue');
      expect(delegatingNode.storedProps.stroke?.width).toBe(2);
      expect(delegatingNode.storedProps.stroke?.pattern).toBe('dashed');

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.storedProps.stroke?.pattern).toBe('dashed');
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

    it('should not affect delegate custom props', () => {
      // Setup - set delegate custom props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.updateCustomProps(
          'star',
          props => {
            props.numberOfSides = 5;
          },
          uow
        )
      );

      // Act - update delegating node custom props
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.updateCustomProps(
          'star',
          props => {
            props.numberOfSides = 8;
          },
          uow
        )
      );

      // Verify
      expect(delegatingNode.storedProps.custom?.star?.numberOfSides).toBe(8);
      expect(delegateNode.storedProps.custom?.star?.numberOfSides).toBe(5);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.storedProps.custom?.star?.numberOfSides).toBe(8);
        expect(delegateNode2.storedProps.custom?.star?.numberOfSides).toBe(5);
      }
    });

    it('should handle multiple custom prop types', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingNode.updateCustomProps(
          'star',
          props => {
            props.numberOfSides = 6;
          },
          uow
        );
      });

      UnitOfWork.execute(model.diagram1, uow => {
        delegatingNode.updateCustomProps(
          'cube',
          props => {
            props.size = 50;
          },
          uow
        );
      });

      // Verify
      expect(delegatingNode.storedProps.custom?.star?.numberOfSides).toBe(6);
      expect(delegatingNode.storedProps.custom?.cube?.size).toBe(50);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.storedProps.custom?.star?.numberOfSides).toBe(6);
        expect(delegatingNode2.storedProps.custom?.cube?.size).toBe(50);
      }
    });
  });

  describe('getPropsInfo', () => {
    it('should delegate to the delegate node', () => {
      // Act
      const propsInfo = delegatingNode.getPropsInfo('stroke.color');

      // Verify - should get the same result as delegate
      const delegatePropsInfo = delegateNode.getPropsInfo('stroke.color');
      expect(propsInfo).toEqual(delegatePropsInfo);
    });
  });

  describe('getText', () => {
    it('should return delegate text when no override is set', () => {
      // Setup - set text on delegate
      UnitOfWork.execute(model.diagram1, uow => delegateNode.setText('Delegate Text', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('Delegate Text');
      expect(delegatingNode.getText()).toBe(delegateNode.getText());

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.getText()).toBe('Delegate Text');
      }
    });

    it('should return overridden text when set', () => {
      // Setup - set text on delegate
      UnitOfWork.execute(model.diagram1, uow => delegateNode.setText('Delegate Text', uow));

      // Act - override text on delegating node
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Override Text', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('Override Text');
      expect(delegateNode.getText()).toBe('Delegate Text');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.getText()).toBe('Override Text');
        expect(delegateNode2.getText()).toBe('Delegate Text');
      }
    });

    it('should persist overridden text after delegate changes', () => {
      // Setup - override text
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Override Text', uow));

      // Act - change delegate text
      UnitOfWork.execute(model.diagram1, uow => delegateNode.setText('New Delegate Text', uow));

      // Verify - delegating node should keep overridden text
      expect(delegatingNode.getText()).toBe('Override Text');
      expect(delegateNode.getText()).toBe('New Delegate Text');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.getText()).toBe('Override Text');
        expect(delegateNode2.getText()).toBe('New Delegate Text');
      }
    });

    it('should handle text with custom id', () => {
      // Setup - set custom text on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateNode.setText('Delegate Custom', uow, 'customId')
      );

      // Act - override custom text on delegating node
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingNode.setText('Override Custom', uow, 'customId')
      );

      // Verify
      expect(delegatingNode.getText('customId')).toBe('Override Custom');
      expect(delegateNode.getText('customId')).toBe('Delegate Custom');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.getText('customId')).toBe('Override Custom');
        expect(delegateNode2.getText('customId')).toBe('Delegate Custom');
      }
    });

    it('should handle empty text', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('');

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.getText()).toBe('');
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

    it('should not affect delegate text', () => {
      // Setup - set delegate text
      UnitOfWork.execute(model.diagram1, uow => delegateNode.setText('Delegate Text', uow));

      const originalDelegateText = delegateNode.getText();

      // Act - update delegating node text
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Override Text', uow));

      // Verify
      expect(delegatingNode.getText()).toBe('Override Text');
      expect(delegateNode.getText()).toBe(originalDelegateText);

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.getText()).toBe('Override Text');
        expect(delegateNode2.getText()).toBe(originalDelegateText);
      }
    });

    it('should update element in unit of work', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingNode.setText('Test Text', uow);

      // Verify
      expect(delegatingNode.getText()).toBe('Test Text');
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should allow multiple text updates with CRDT sync', () => {
      // Act - first update
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Text 1', uow));
      expect(delegatingNode.getText()).toBe('Text 1');
      if (delegatingNode2) expect(delegatingNode2.getText()).toBe('Text 1');

      // Act - second update
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Text 2', uow));
      expect(delegatingNode.getText()).toBe('Text 2');
      if (delegatingNode2) expect(delegatingNode2.getText()).toBe('Text 2');

      // Act - third update
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText('Text 3', uow));
      expect(delegatingNode.getText()).toBe('Text 3');
      if (delegatingNode2) expect(delegatingNode2.getText()).toBe('Text 3');
    });

    it('should create snapshot when setting text', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingNode.setText('Snapshot Text', uow);

      // Verify
      expect(delegatingNode.getText()).toBe('Snapshot Text');
      expect(uow.contains(delegatingNode, 'update')).toBe(true);
    });

    it('should handle text with special characters', () => {
      // Act
      const specialText = 'Text with\nnewlines\tand\ttabs & special chars <>&"';
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText(specialText, uow));

      // Verify
      expect(delegatingNode.getText()).toBe(specialText);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.getText()).toBe(specialText);
      }
    });

    it('should handle very long text', () => {
      // Act
      const longText = 'A'.repeat(10000);
      UnitOfWork.execute(model.diagram1, uow => delegatingNode.setText(longText, uow));

      // Verify
      expect(delegatingNode.getText()).toBe(longText);

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.getText()).toBe(longText);
      }
    });
  });

  describe('texts', () => {
    it('should return delegate texts when no override is set', () => {
      // Setup - set texts on delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateNode.setText('Main Text', uow);
        delegateNode.setText('Custom 1', uow, 'custom1');
        delegateNode.setText('Custom 2', uow, 'custom2');
      });

      // Verify
      expect(delegatingNode.texts.text).toBe('Main Text');
      expect(delegatingNode.texts.custom1).toBe('Custom 1');
      expect(delegatingNode.texts.custom2).toBe('Custom 2');

      // Verify CRDT sync
      if (delegatingNode2) {
        expect(delegatingNode2.texts.text).toBe('Main Text');
        expect(delegatingNode2.texts.custom1).toBe('Custom 1');
      }
    });

    it('should merge delegate texts with overridden texts', () => {
      // Setup - set texts on delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateNode.setText('Delegate Main', uow);
        delegateNode.setText('Delegate Custom 1', uow, 'custom1');
      });

      // Act - override some texts on delegating node
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingNode.setText('Override Main', uow);
        delegatingNode.setText('Override Custom 2', uow, 'custom2');
      });

      // Verify - should have overridden main and custom2, but delegate custom1
      expect(delegatingNode.texts.text).toBe('Override Main');
      expect(delegatingNode.texts.custom1).toBe('Delegate Custom 1');
      expect(delegatingNode.texts.custom2).toBe('Override Custom 2');
      expect(delegateNode.texts.text).toBe('Delegate Main');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.texts.text).toBe('Override Main');
        expect(delegatingNode2.texts.custom1).toBe('Delegate Custom 1');
        expect(delegatingNode2.texts.custom2).toBe('Override Custom 2');
      }
    });

    it('should persist overridden texts after delegate changes', () => {
      // Setup - override texts
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingNode.setText('Override Main', uow);
        delegatingNode.setText('Override Custom', uow, 'custom1');
      });

      // Act - change delegate texts
      UnitOfWork.execute(model.diagram1, uow => {
        delegateNode.setText('New Delegate Main', uow);
        delegateNode.setText('New Delegate Custom', uow, 'custom1');
      });

      // Verify - delegating node should keep overridden texts
      expect(delegatingNode.texts.text).toBe('Override Main');
      expect(delegatingNode.texts.custom1).toBe('Override Custom');
      expect(delegateNode.texts.text).toBe('New Delegate Main');

      // Verify CRDT sync
      if (delegatingNode2 && delegateNode2) {
        expect(delegatingNode2.texts.text).toBe('Override Main');
        expect(delegatingNode2.texts.custom1).toBe('Override Custom');
      }
    });
  });

  describe('textsCloned', () => {
    it('should return a deep clone of texts', () => {
      // Setup
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingNode.setText('Main Text', uow);
        delegatingNode.setText('Custom Text', uow, 'custom1');
      });

      // Act
      const cloned = delegatingNode.textsCloned;
      cloned.text = 'Modified Main';
      cloned.custom1 = 'Modified Custom';

      // Verify - original should not be affected
      expect(delegatingNode.texts.text).toBe('Main Text');
      expect(delegatingNode.texts.custom1).toBe('Custom Text');
      expect(cloned.text).toBe('Modified Main');
      expect(cloned.custom1).toBe('Modified Custom');
    });

    it('should clone merged texts from delegate and override', () => {
      // Setup
      UnitOfWork.execute(model.diagram1, uow => {
        delegateNode.setText('Delegate Main', uow);
        delegateNode.setText('Delegate Custom', uow, 'custom1');
      });

      UnitOfWork.execute(model.diagram1, uow => {
        delegatingNode.setText('Override Main', uow);
      });

      // Act
      const cloned = delegatingNode.textsCloned;
      cloned.text = 'Modified';

      // Verify - original merged texts should not be affected
      expect(delegatingNode.texts.text).toBe('Override Main');
      expect(delegatingNode.texts.custom1).toBe('Delegate Custom');
      expect(cloned.text).toBe('Modified');
      expect(cloned.custom1).toBe('Delegate Custom');
    });
  });
});
