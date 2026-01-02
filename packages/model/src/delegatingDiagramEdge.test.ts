import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import {
  type StandardTestModel,
  standardTestModel
} from './test-support/collaborationModelTestUtils';
import type { DiagramEdge } from './diagramEdge';
import { ModificationLayer } from './diagramLayerModification';
import { DelegatingDiagramEdge } from './delegatingDiagramEdge';
import { FreeEndpoint } from './endpoint';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('DelegatingDiagramEdge [%s]', (_name, backend) => {
  let model: StandardTestModel;
  let baseEdge: DiagramEdge;
  let baseEdge2: DiagramEdge | undefined;
  let modLayer: ModificationLayer;
  let modLayer2: ModificationLayer | undefined;
  let delegatingEdge: DelegatingDiagramEdge;
  let delegatingEdge2: DelegatingDiagramEdge | undefined;

  beforeEach(() => {
    backend.beforeEach();
    model = standardTestModel(backend);

    // Create an edge
    baseEdge = model.layer1.addEdge();

    // Find the delegate edge in diagram2 if it exists
    baseEdge2 = model.diagram2?.lookup(baseEdge.id) as DiagramEdge;

    // Create a modification layer and add it to the diagram
    modLayer = new ModificationLayer('mod-layer-1', 'Modification Layer', model.diagram1, []);
    UnitOfWork.execute(model.diagram1, uow => model.diagram1.layers.add(modLayer, uow));

    model.diagram1.layers.active = model.layer1;

    // Find the modification layer in diagram2 if it exists
    if (model.diagram2) {
      modLayer2 = model.diagram2.layers.byId('mod-layer-1') as ModificationLayer;
    }

    // Create a delegating edge by modifying the delegate
    delegatingEdge = new DelegatingDiagramEdge(
      'delegating-edge-override-' + baseEdge.id,
      baseEdge,
      modLayer
    );
    UnitOfWork.execute(model.diagram1, uow =>
      modLayer.modifyChange(baseEdge.id, delegatingEdge, uow)
    );

    if (modLayer2) {
      delegatingEdge2 = modLayer2.elements.find(
        e => e.id === 'delegating-edge-override-' + baseEdge.id
      ) as DelegatingDiagramEdge;
    }
  });

  afterEach(backend.afterEach);

  describe('storedProps', () => {
    it('should return delegate props when no override is set', () => {
      // Setup - set some props on the delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('blue');
      expect(delegatingEdge.storedProps.stroke?.width).toBe(2);

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('blue');
        expect(delegatingEdge2.storedProps.stroke?.width).toBe(2);
      }
    });

    it('should merge delegate props with overridden props', () => {
      // Setup - set props on delegate
      UnitOfWork.execute(model.diagram1, uow =>
        baseEdge.updateProps(props => {
          props.stroke = { color: 'blue', width: 2 };
          props.arrow = { end: { type: 'BALL_FILLED', size: 10 } };
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
      expect(delegatingEdge.storedProps.arrow?.end?.type).toBe('BALL_FILLED');
      expect(baseEdge.storedProps.stroke?.color).toBe('blue');

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('red');
        expect(delegatingEdge2.storedProps.stroke?.width).toBe(3);
        expect(delegatingEdge2.storedProps.arrow?.end?.type).toBe('BALL_FILLED');
        expect(baseEdge2.storedProps.stroke?.color).toBe('blue');
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
          props.arrow = { end: { type: 'BAR', size: 15 } };
        }, uow)
      );

      // Verify
      expect(delegatingEdge.storedProps.stroke?.color).toBe('orange');
      expect(delegatingEdge.storedProps.arrow?.end?.type).toBe('BAR');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);

      // Verify CRDT sync
      if (delegatingEdge2) {
        expect(delegatingEdge2.storedProps.stroke?.color).toBe('orange');
        expect(delegatingEdge2.storedProps.arrow?.end?.type).toBe('BAR');
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
  });

  describe('waypoints', () => {
    it('should return delegate waypoints when no override is set', () => {
      // Setup - add waypoints to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        baseEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
        baseEdge.addWaypoint({ point: { x: 20, y: 20 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      expect(delegatingEdge.waypoints[1]?.point).toEqual({ x: 20, y: 20 });

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
        expect(delegatingEdge2.waypoints[1]?.point).toEqual({ x: 20, y: 20 });
      }
    });

    it('should return overridden waypoints when set', () => {
      // Setup - add waypoints to delegate
      UnitOfWork.execute(model.diagram1, uow => {
        baseEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - add waypoint to delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.addWaypoint({ point: { x: 50, y: 50 } }, uow);
      });

      // Verify - delegating edge should have 2 waypoints (copied from delegate + new one)
      expect(delegatingEdge.waypoints).toHaveLength(2);
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      expect(delegatingEdge.waypoints[1]?.point).toEqual({ x: 50, y: 50 });
      expect(baseEdge.waypoints).toHaveLength(1);
      expect(baseEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(2);
        expect(baseEdge2.waypoints).toHaveLength(1);
      }
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
        baseEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
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
      expect(baseEdge.waypoints).toHaveLength(1);

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.waypoints).toHaveLength(1);
        expect(baseEdge2.waypoints).toHaveLength(1);
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
        baseEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - move waypoint on delegating edge
      const waypointToMove = delegatingEdge.waypoints[0]!;
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.moveWaypoint(waypointToMove, { x: 99, y: 88 }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
      expect(baseEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
        expect(baseEdge2.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
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
        baseEdge.addWaypoint({ point: { x: 10, y: 10 } }, uow);
      });

      // Act - replace waypoint on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.replaceWaypoint(0, { point: { x: 99, y: 88 } }, uow);
      });

      // Verify
      expect(delegatingEdge.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
      expect(baseEdge.waypoints[0]?.point).toEqual({ x: 10, y: 10 });

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.waypoints[0]?.point).toEqual({ x: 99, y: 88 });
        expect(baseEdge2.waypoints[0]?.point).toEqual({ x: 10, y: 10 });
      }
    });
  });

  describe('start endpoint', () => {
    it('should return delegate start when no override is set', () => {
      // Verify
      expect(delegatingEdge.start).toEqual(baseEdge.start);
      expect(delegatingEdge.start.position).toEqual(baseEdge.start.position);

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.start.position).toEqual(baseEdge2.start.position);
      }
    });

    it('should return overridden start when set', () => {
      const originalStart = baseEdge.start;

      // Act - set new start on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setStart(new FreeEndpoint({ x: 100, y: 200 }), uow);
      });

      // Verify - delegating edge should have new start, delegate unchanged
      expect(delegatingEdge.start.position).toEqual({ x: 100, y: 200 });
      expect(baseEdge.start).toEqual(originalStart);

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.start.position).toEqual({ x: 100, y: 200 });
        expect(baseEdge2.start).toEqual(originalStart);
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
  });

  describe('end endpoint', () => {
    it('should return delegate end when no override is set', () => {
      // Verify
      expect(delegatingEdge.end).toEqual(baseEdge.end);
      expect(delegatingEdge.end.position).toEqual(baseEdge.end.position);

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.end.position).toEqual(baseEdge2.end.position);
      }
    });

    it('should return overridden end when set', () => {
      const originalEnd = baseEdge.end;

      // Act - set new end on delegating edge
      UnitOfWork.execute(model.diagram1, uow => {
        delegatingEdge.setEnd(new FreeEndpoint({ x: 300, y: 400 }), uow);
      });

      // Verify - delegating edge should have new end, delegate unchanged
      expect(delegatingEdge.end.position).toEqual({ x: 300, y: 400 });
      expect(baseEdge.end).toEqual(originalEnd);

      // Verify CRDT sync
      if (delegatingEdge2 && baseEdge2) {
        expect(delegatingEdge2.end.position).toEqual({ x: 300, y: 400 });
        expect(baseEdge2.end).toEqual(originalEnd);
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
  });
});
