import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import {
  Backends,
  type StandardTestModel,
  standardTestModel
} from './collaboration/collaborationTestUtils';
import type { DiagramEdge } from './diagramEdge';
import { ModificationLayer } from './diagramLayerModification';
import { DelegatingDiagramEdge } from './delegatingDiagramEdge';

describe.each(Backends.all())('DelegatingDiagramEdge [%s]', (_name, backend) => {
  let model: StandardTestModel;
  let delegateEdge: DiagramEdge;
  let delegateEdge2: DiagramEdge | undefined;
  let modificationLayer: ModificationLayer;
  let modificationLayer2: ModificationLayer | undefined;
  let delegatingEdge: DelegatingDiagramEdge;
  let delegatingEdge2: DelegatingDiagramEdge | undefined;

  beforeEach(() => {
    backend.beforeEach();
    model = standardTestModel(backend);

    // Create an edge
    delegateEdge = model.layer1.addEdge();

    // Find the delegate edge in diagram2 if it exists
    delegateEdge2 = model.diagram2?.lookup(delegateEdge.id) as DiagramEdge | undefined;

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

    // Create a delegating edge by modifying the delegate
    const delegatingEdgeInstance = new DelegatingDiagramEdge(
      'delegating-edge-override-' + delegateEdge.id,
      delegateEdge,
      modificationLayer
    );
    modificationLayer.modifyChange(
      delegateEdge.id,
      delegatingEdgeInstance,
      UnitOfWork.immediate(model.diagram1)
    );

    // Get reference to the delegating edges
    delegatingEdge = modificationLayer.elements.find(
      e => e.id === 'delegating-edge-override-' + delegateEdge.id
    ) as DelegatingDiagramEdge;

    if (modificationLayer2) {
      delegatingEdge2 = modificationLayer2.elements.find(
        e => e.id === 'delegating-edge-override-' + delegateEdge.id
      ) as DelegatingDiagramEdge | undefined;
    }
  });

  afterEach(backend.afterEach);

  describe('storedProps', () => {
    it('should return delegate props when no override is set', () => {
      // Setup - set some props on the delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('blue');
      expect(delegatingEdge.storedProps.stroke?.width).toBe(2);
      expect(delegatingEdge.storedProps).toMatchObject(delegateEdge.storedProps);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('blue');
        expect(delegatingEdge2.storedProps.stroke?.width).toBe(2);
      }
    });

    it('should merge delegate props with overridden props', () => {
      // Setup - set props on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
          props.arrow = { end: { type: 'arrow', size: 10 } };
        }, uow)
      );

      // Act - override some props on delegating edge
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'red', width: 3 };
        }, uow)
      );

      // Verify - should have overridden stroke but delegate arrow
      expect(delegatingEdge.storedProps.stroke?.color).toBe('red');
      expect(delegatingEdge.storedProps.stroke?.width).toBe(3);
      expect(delegatingEdge.storedProps.arrow?.end?.type).toBe('arrow');
      expect(delegateEdge.storedProps.stroke?.color).toBe('blue');

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('red');
        expect(delegatingEdge2.storedProps.stroke?.width).toBe(3);
        expect(delegatingEdge2.storedProps.arrow?.end?.type).toBe('arrow');
        expect(delegateEdge2.storedProps.stroke?.color).toBe('blue');
      }
    });

    it('should persist overridden props after delegate changes', () => {
      // Setup - override props
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'red', width: 5 };
        }, uow)
      );

      // Act - change delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateProps(props => {
          props.stroke = { color: 'yellow', width: 1 };
        }, uow)
      );

      // Verify - delegating edge should keep overridden props
      expect(delegatingEdge.storedProps.stroke?.color).toBe('red');
      expect(delegatingEdge.storedProps.stroke?.width).toBe(5);
      expect(delegateEdge.storedProps.stroke?.color).toBe('yellow');

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('red');
        expect(delegateEdge2.storedProps.stroke?.color).toBe('yellow');
      }
    });
  });

  describe('storedPropsCloned', () => {
    it('should return a deep clone of stored props', () => {
      // Setup
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );

      // Act
      const cloned = delegatingEdge.storedPropsCloned;
      const modifiedCloned = { ...cloned, stroke: { ...cloned.stroke, color: 'modified' } };

      // Verify - clone is separate from original
      expect(delegatingEdge.storedProps.stroke?.color).toBe('blue');
      expect(modifiedCloned.stroke?.color).toBe('modified');
    });
  });

  describe('editProps', () => {
    it('should return merged props for editing', () => {
      // Setup - set delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateProps(props => {
          props.arrow = { start: { type: 'circle', size: 8 } };
        }, uow)
      );

      // Act - override on delegating edge
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'red', width: 2 };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.editProps.stroke?.color).toBe('red');
      expect(delegatingEdge.editProps.arrow?.start?.type).toBe('circle');

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.editProps.stroke?.color).toBe('red');
        expect(delegatingEdge2.editProps.arrow?.start?.type).toBe('circle');
      }
    });
  });

  describe('renderProps', () => {
    it('should return merged props for rendering', () => {
      // Setup - set delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateProps(props => {
          props.arrow = { end: { type: 'arrow', size: 12 } };
        }, uow)
      );

      // Act - override on delegating edge
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'purple', width: 3 };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.renderProps.stroke?.color).toBe('purple');
      expect(delegatingEdge.renderProps.arrow?.end?.type).toBe('arrow');

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.renderProps.stroke?.color).toBe('purple');
        expect(delegatingEdge2.renderProps.arrow?.end?.type).toBe('arrow');
      }
    });
  });

  describe('updateProps', () => {
    it('should update props and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'orange', width: 4 };
          props.arrow = { end: { type: 'diamond', size: 15 } };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('orange');
      expect(delegatingEdge.storedProps.arrow?.end?.type).toBe('diamond');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('orange');
        expect(delegatingEdge2.storedProps.arrow?.end?.type).toBe('diamond');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate props', () => {
      // Setup - set delegate props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateProps(props => {
          props.stroke = { color: 'black', width: 1 };
        }, uow)
      );

      const originalDelegateColor = delegateEdge.storedProps.stroke?.color;

      // Act - update delegating edge props
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'white', width: 5 };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('white');
      expect(delegateEdge.storedProps.stroke?.color).toBe(originalDelegateColor);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('white');
        expect(delegateEdge2.storedProps.stroke?.color).toBe(originalDelegateColor);
      }
    });

    it('should update element in unit of work', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingEdge.updateProps(props => {
        props.stroke = { color: 'magenta', width: 2 };
      }, uow);

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('magenta');
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });

    it('should allow multiple prop updates with CRDT sync', () => {
      // Act - first update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'red', width: 1 };
        }, uow)
      );
      expect(delegatingEdge.storedProps.stroke?.color).toBe('red');
      if (delegatingEdge2) expect(delegatingEdge2.storedProps.stroke?.color).toBe('red');

      // Act - second update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );
      expect(delegatingEdge.storedProps.stroke?.color).toBe('blue');
      if (delegatingEdge2) expect(delegatingEdge2.storedProps.stroke?.color).toBe('blue');

      // Act - third update
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.arrow = { end: { type: 'arrow', size: 10 } };
        }, uow)
      );
      expect(delegatingEdge.storedProps.arrow?.end?.type).toBe('arrow');
      if (delegatingEdge2) expect(delegatingEdge2.storedProps.arrow?.end?.type).toBe('arrow');
    });

    it('should create snapshot when updating props', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingEdge.updateProps(props => {
        props.stroke = { color: 'green', width: 3 };
      }, uow);

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('green');
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });

    it('should handle deep property updates', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2, pattern: 'dashed' };
          props.arrow = { start: { type: 'circle', size: 8 }, end: { type: 'arrow', size: 10 } };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('blue');
      expect(delegatingEdge.storedProps.stroke?.width).toBe(2);
      expect(delegatingEdge.storedProps.stroke?.pattern).toBe('dashed');
      expect(delegatingEdge.storedProps.arrow?.start?.type).toBe('circle');
      expect(delegatingEdge.storedProps.arrow?.end?.type).toBe('arrow');

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.pattern).toBe('dashed');
        expect(delegatingEdge2.storedProps.arrow?.start?.type).toBe('circle');
      }
    });

    it('should handle edge-specific properties', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateProps(props => {
          props.lineHops = { type: 'above-arc', size: 15 };
          props.spacing = { start: 10, end: 20 };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.lineHops?.type).toBe('above-arc');
      expect(delegatingEdge.storedProps.lineHops?.size).toBe(15);
      expect(delegatingEdge.storedProps.spacing?.start).toBe(10);
      expect(delegatingEdge.storedProps.spacing?.end).toBe(20);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.storedProps.lineHops?.type).toBe('above-arc');
        expect(delegatingEdge2.storedProps.spacing?.start).toBe(10);
      }
    });
  });

  describe('updateCustomProps', () => {
    it('should update custom props and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateCustomProps(
          'blockArrow',
          props => {
            props.width = 20;
          },
          uow
        )
      );

      // Verify
      expect(delegatingEdge.storedProps.custom?.blockArrow?.width).toBe(20);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.storedProps.custom?.blockArrow?.width).toBe(20);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate custom props', () => {
      // Setup - set delegate custom props
      UnitOfWork.execute(model.diagram1, uow =>
        delegateEdge.updateCustomProps(
          'blockArrow',
          props => {
            props.width = 10;
          },
          uow
        )
      );

      // Act - update delegating edge custom props
      UnitOfWork.execute(model.diagram1, uow =>
        delegatingEdge.updateCustomProps(
          'blockArrow',
          props => {
            props.width = 25;
          },
          uow
        )
      );

      // Verify
      expect(delegatingEdge.storedProps.custom?.blockArrow?.width).toBe(25);
      expect(delegateEdge.storedProps.custom?.blockArrow?.width).toBe(10);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.storedProps.custom?.blockArrow?.width).toBe(25);
        expect(delegateEdge2.storedProps.custom?.blockArrow?.width).toBe(10);
      }
    });

    it('should handle different blockArrow properties', () => {
      // Act - set width
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.updateCustomProps(
          'blockArrow',
          props => {
            props.width = 15;
          },
          uow
        );
      });

      // Act - set arrowWidth
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.updateCustomProps(
          'blockArrow',
          props => {
            props.arrowWidth = 30;
          },
          uow
        );
      });

      // Verify
      expect(delegatingEdge.storedProps.custom?.blockArrow?.width).toBe(15);
      expect(delegatingEdge.storedProps.custom?.blockArrow?.arrowWidth).toBe(30);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.storedProps.custom?.blockArrow?.width).toBe(15);
        expect(delegatingEdge2.storedProps.custom?.blockArrow?.arrowWidth).toBe(30);
      }
    });
  });

  describe('getPropsInfo', () => {
    it('should delegate to the delegate edge', () => {
      // Act
      const propsInfo = delegatingEdge.getPropsInfo('stroke.color');

      // Verify - should get the same result as delegate
      const delegatePropsInfo = delegateEdge.getPropsInfo('stroke.color');
      expect(propsInfo).toEqual(delegatePropsInfo);
    });
  });
});
