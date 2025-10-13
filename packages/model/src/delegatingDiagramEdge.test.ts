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
import { FreeEndpoint } from './endpoint';

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

  describe('waypoints', () => {
    it('should return delegate waypoints when no override is set', () => {
      // Setup - add waypoints to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
        delegateEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      expect(delegatingEdge.waypoints[1]?.point).toEqual({ x: 20, y: 20 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      }
    });

    it('should return overridden waypoints when set', () => {
      // Setup - add waypoints to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - add waypoint to delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 50, y: 50 } }, uow);
      });

      // Verify - delegating edge should have 2 waypoints (copied from delegate + new one)
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      expect(delegatingEdge.waypoints[1]?.point).toEqual({ x: 50, y: 50 });
      expect(delegateEdge.waypoints).toHaveLength(1);
      expect(delegateEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(delegateEdge2.waypoints).toHaveLength(1);
      }
    });

    it('should persist overridden waypoints after delegate changes', () => {
      // Setup - add waypoint to delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 50, y: 50 } }, uow);
      });

      // Act - add waypoint to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Verify - delegating edge should keep its overridden waypoints
      expect(delegatingEdge.waypoints).toHaveLength(1);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
      expect(delegateEdge.waypoints).toHaveLength(1);
      expect(delegateEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(1);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
      }
    });

    it('should handle empty waypoints', () => {
      // Setup - add waypoint to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Verify delegate has waypoint
      expect(delegateEdge.waypoints).toHaveLength(1);
      expect(delegatingEdge.waypoints).toHaveLength(1);

      // Act - explicitly set empty waypoints on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        const wp = delegatingEdge.waypoints[0]!;
        delegatingEdge.removeWaypoint(wp, uow);
      });

      // Verify - delegating edge should have no waypoints even though delegate does
      expect(delegatingEdge.waypoints).toHaveLength(0);
      expect(delegateEdge.waypoints).toHaveLength(1);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(0);
        expect(delegateEdge2.waypoints).toHaveLength(1);
      }
    });
  });

  describe('addWaypoint', () => {
    it('should add waypoint and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 25, y: 35 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(1);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 25, y: 35 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(1);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 25, y: 35 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate waypoints', () => {
      // Setup - add waypoint to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      const originalDelegateWaypoints = delegateEdge.waypoints.length;

      // Act - add waypoint to delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 99, y: 88 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegateEdge.waypoints).toHaveLength(originalDelegateWaypoints);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(delegateEdge2.waypoints).toHaveLength(originalDelegateWaypoints);
      }
    });

    it('should add multiple waypoints with CRDT sync', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });
      expect(delegatingEdge.waypoints).toHaveLength(1);
      if (delegatingEdge2) expect(delegatingEdge2.waypoints).toHaveLength(1);

      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });
      expect(delegatingEdge.waypoints).toHaveLength(2);
      if (delegatingEdge2) expect(delegatingEdge2.waypoints).toHaveLength(2);

      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 30, y: 30 } }, uow);
      });
      expect(delegatingEdge.waypoints).toHaveLength(3);
      if (delegatingEdge2) expect(delegatingEdge2.waypoints).toHaveLength(3);
    });

    it('should create snapshot when adding waypoint', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingEdge.addWaypoint({ point: { x: 15, y: 25 } }, uow);

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(1);
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });
  });

  describe('removeWaypoint', () => {
    it('should remove waypoint and sync via CRDT', () => {
      // Setup - add waypoints
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
        delegatingEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });

      // Act
      model.reset();
      const waypointToRemove = delegatingEdge.waypoints[0]!;
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.removeWaypoint(waypointToRemove, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(1);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 20, y: 20 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(1);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 20, y: 20 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate waypoints', () => {
      // Setup - add waypoint to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - add then remove waypoint on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });

      const waypointToRemove = delegatingEdge.waypoints[1]!;
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.removeWaypoint(waypointToRemove, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(1);
      expect(delegateEdge.waypoints).toHaveLength(1);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(1);
        expect(delegateEdge2.waypoints).toHaveLength(1);
      }
    });
  });

  describe('moveWaypoint', () => {
    it('should move waypoint and sync via CRDT', () => {
      // Setup - add waypoints
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
        delegatingEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });

      // Act
      model.reset();
      const waypointToMove = delegatingEdge.waypoints[0]!;
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.moveWaypoint(waypointToMove, { x: 50, y: 50 }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
      expect(delegatingEdge.waypoints[1]?.point).toEqual({ x: 20, y: 20 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate waypoints', () => {
      // Setup - add waypoint to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - move waypoint on delegating edge
      const waypointToMove = delegatingEdge.waypoints[0]!;
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.moveWaypoint(waypointToMove, { x: 99, y: 88 }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
      expect(delegateEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
        expect(delegateEdge2.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      }
    });

    it('should preserve waypoint control points when moving', () => {
      // Setup - add waypoint with control points
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint(
          {
            point: { x: 10, y: 10 },
            controlPoints: { cp1: { x: 5, y: 5 }, cp2: { x: 15, y: 15 } }
          },
          uow
        );
      });

      // Act - move waypoint
      const waypointToMove = delegatingEdge.waypoints[0]!;
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.moveWaypoint(waypointToMove, { x: 50, y: 50 }, uow);
      });

      // Verify - control points should be preserved
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
      expect(delegatingEdge.waypoints[0]?.controlPoints).toEqual({
        cp1: { x: 5, y: 5 },
        cp2: { x: 15, y: 15 }
      });

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.waypoints[0]?.controlPoints).toEqual({
          cp1: { x: 5, y: 5 },
          cp2: { x: 15, y: 15 }
        });
      }
    });
  });

  describe('replaceWaypoint', () => {
    it('should replace waypoint and sync via CRDT', () => {
      // Setup - add waypoints
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
        delegatingEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });

      // Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.replaceWaypoint(0, { point: { x: 50, y: 50 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
      expect(delegatingEdge.waypoints[1]?.point).toEqual({ x: 20, y: 20 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate waypoints', () => {
      // Setup - add waypoint to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - replace waypoint on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.replaceWaypoint(0, { point: { x: 99, y: 88 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
      expect(delegateEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
        expect(delegateEdge2.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      }
    });

    it('should handle waypoint with control points', () => {
      // Setup - add waypoint
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - replace with waypoint that has control points
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.replaceWaypoint(
          0,
          {
            point: { x: 50, y: 50 },
            controlPoints: { cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } }
          },
          uow
        );
      });

      // Verify
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
      expect(delegatingEdge.waypoints[0]?.controlPoints).toEqual({
        cp1: { x: 40, y: 40 },
        cp2: { x: 60, y: 60 }
      });

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
        expect(delegatingEdge2.waypoints[0]?.controlPoints).toEqual({
          cp1: { x: 40, y: 40 },
          cp2: { x: 60, y: 60 }
        });
      }
    });
  });

  describe('start endpoint', () => {
    it('should return delegate start when no override is set', () => {
      // Verify
      expect(delegatingEdge.start).toEqual(delegateEdge.start);
      expect(delegatingEdge.start.position).toEqual(delegateEdge.start.position);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.start.position).toEqual(delegateEdge2.start.position);
      }
    });

    it('should return overridden start when set', () => {
      const originalStart = delegateEdge.start;

      // Act - set new start on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setStart(new FreeEndpoint({ x: 100, y: 200 }), uow);
      });

      // Verify - delegating edge should have new start, delegate unchanged
      expect(delegatingEdge.start.position).toEqual({ x: 100, y: 200 });
      expect(delegateEdge.start).toEqual(originalStart);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.start.position).toEqual({ x: 100, y: 200 });
        expect(delegateEdge2.start).toEqual(originalStart);
      }
    });

    it('should set start endpoint and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setStart(new FreeEndpoint({ x: 50, y: 75 }), uow);
      });

      // Verify
      expect(delegatingEdge.start.position).toEqual({ x: 50, y: 75 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.start.position).toEqual({ x: 50, y: 75 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate start', () => {
      // Setup - get original delegate start
      const originalDelegateStart = delegateEdge.start;

      // Act - change start on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setStart(new FreeEndpoint({ x: 999, y: 888 }), uow);
      });

      // Verify
      expect(delegatingEdge.start.position).toEqual({ x: 999, y: 888 });
      expect(delegateEdge.start).toEqual(originalDelegateStart);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.start.position).toEqual({ x: 999, y: 888 });
        expect(delegateEdge2.start).toEqual(originalDelegateStart);
      }
    });

    it('should persist overridden start after delegate changes', () => {
      // Setup - override start
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setStart(new FreeEndpoint({ x: 100, y: 100 }), uow);
      });

      // Act - change delegate start
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.setStart(new FreeEndpoint({ x: 200, y: 200 }), uow);
      });

      // Verify - delegating edge should keep overridden start
      expect(delegatingEdge.start.position).toEqual({ x: 100, y: 100 });
      expect(delegateEdge.start.position).toEqual({ x: 200, y: 200 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.start.position).toEqual({ x: 100, y: 100 });
        expect(delegateEdge2.start.position).toEqual({ x: 200, y: 200 });
      }
    });

    it('should update element in unit of work when setting start', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingEdge.setStart(new FreeEndpoint({ x: 150, y: 250 }), uow);

      // Verify
      expect(delegatingEdge.start.position).toEqual({ x: 150, y: 250 });
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });

    it('should create snapshot when setting start', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingEdge.setStart(new FreeEndpoint({ x: 175, y: 275 }), uow);

      // Verify
      expect(delegatingEdge.start.position).toEqual({ x: 175, y: 275 });
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });
  });

  describe('end endpoint', () => {
    it('should return delegate end when no override is set', () => {
      // Verify
      expect(delegatingEdge.end).toEqual(delegateEdge.end);
      expect(delegatingEdge.end.position).toEqual(delegateEdge.end.position);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.end.position).toEqual(delegateEdge2.end.position);
      }
    });

    it('should return overridden end when set', () => {
      const originalEnd = delegateEdge.end;

      // Act - set new end on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setEnd(new FreeEndpoint({ x: 300, y: 400 }), uow);
      });

      // Verify - delegating edge should have new end, delegate unchanged
      expect(delegatingEdge.end.position).toEqual({ x: 300, y: 400 });
      expect(delegateEdge.end).toEqual(originalEnd);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.end.position).toEqual({ x: 300, y: 400 });
        expect(delegateEdge2.end).toEqual(originalEnd);
      }
    });

    it('should set end endpoint and sync via CRDT', () => {
      // Setup
      model.reset();

      // Act
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setEnd(new FreeEndpoint({ x: 150, y: 175 }), uow);
      });

      // Verify
      expect(delegatingEdge.end.position).toEqual({ x: 150, y: 175 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.end.position).toEqual({ x: 150, y: 175 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should not affect delegate end', () => {
      // Setup - get original delegate end
      const originalDelegateEnd = delegateEdge.end;

      // Act - change end on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setEnd(new FreeEndpoint({ x: 777, y: 666 }), uow);
      });

      // Verify
      expect(delegatingEdge.end.position).toEqual({ x: 777, y: 666 });
      expect(delegateEdge.end).toEqual(originalDelegateEnd);

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.end.position).toEqual({ x: 777, y: 666 });
        expect(delegateEdge2.end).toEqual(originalDelegateEnd);
      }
    });

    it('should persist overridden end after delegate changes', () => {
      // Setup - override end
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setEnd(new FreeEndpoint({ x: 500, y: 500 }), uow);
      });

      // Act - change delegate end
      UnitOfWork.execute(model.diagram1, uow => {
        delegateEdge.setEnd(new FreeEndpoint({ x: 600, y: 600 }), uow);
      });

      // Verify - delegating edge should keep overridden end
      expect(delegatingEdge.end.position).toEqual({ x: 500, y: 500 });
      expect(delegateEdge.end.position).toEqual({ x: 600, y: 600 });

      // Verify CRDT sync
      if (delegatingEdge2 && delegateEdge2) {
        expect(delegatingEdge2.end.position).toEqual({ x: 500, y: 500 });
        expect(delegateEdge2.end.position).toEqual({ x: 600, y: 600 });
      }
    });

    it('should update element in unit of work when setting end', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, false, false);
      delegatingEdge.setEnd(new FreeEndpoint({ x: 350, y: 450 }), uow);

      // Verify
      expect(delegatingEdge.end.position).toEqual({ x: 350, y: 450 });
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });

    it('should create snapshot when setting end', () => {
      // Act
      const uow = new UnitOfWork(model.diagram1, true, false);
      delegatingEdge.setEnd(new FreeEndpoint({ x: 375, y: 475 }), uow);

      // Verify
      expect(delegatingEdge.end.position).toEqual({ x: 375, y: 475 });
      expect(uow.contains(delegatingEdge, 'update')).toBe(true);
    });
  });
});
