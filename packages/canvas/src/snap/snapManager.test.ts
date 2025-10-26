import { describe, expect, test, vi } from 'vitest';
import { SnapMarkers } from './snapManager';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Line } from '@diagram-craft/geometry/line';
import { Axis } from '@diagram-craft/geometry/axis';
import type { SnapMarker } from './snapManager';

describe('SnapMarkers', () => {
  describe('get', () => {
    test('should return same instance for same diagram', () => {
      const { diagram } = TestModel.newDiagramWithLayer();

      const instance1 = SnapMarkers.get(diagram);
      const instance2 = SnapMarkers.get(diagram);

      expect(instance1).toBe(instance2);
    });

    test('should return different instances for different diagrams', () => {
      const { diagram: diagram1 } = TestModel.newDiagramWithLayer();
      const { diagram: diagram2 } = TestModel.newDiagramWithLayer();

      const instance1 = SnapMarkers.get(diagram1);
      const instance2 = SnapMarkers.get(diagram2);

      expect(instance1).not.toBe(instance2);
    });

    test('should create new instance if not exists', () => {
      const { diagram } = TestModel.newDiagramWithLayer();

      const instance = SnapMarkers.get(diagram);

      expect(instance).toBeInstanceOf(SnapMarkers);
    });
  });

  describe('markers getter', () => {
    test('should return empty array initially', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const snapMarkers = SnapMarkers.get(diagram);

      expect(snapMarkers.markers).toEqual([]);
    });

    test('should return markers after set', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const snapMarkers = SnapMarkers.get(diagram);

      const testMarkers: SnapMarker[] = [
        {
          line: Line.horizontal(100, [0, 200]),
          selfMagnet: {
            type: 'source',
            axis: Axis.h,
            line: Line.horizontal(100, [50, 150])
          },
          matchingMagnet: {
            type: 'node',
            axis: Axis.h,
            line: Line.horizontal(100, [0, 200]),
            // @ts-ignore
            node: { id: 'node1' }
          }
        }
      ];

      snapMarkers.set(testMarkers);

      expect(snapMarkers.markers).toBe(testMarkers);
      expect(snapMarkers.markers).toHaveLength(1);
    });
  });

  describe('set', () => {
    test('should emit set event', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const snapMarkers = SnapMarkers.get(diagram);

      const listener = vi.fn();
      snapMarkers.on('set', listener);

      const testMarkers: SnapMarker[] = [
        {
          line: Line.horizontal(100, [0, 200]),
          selfMagnet: {
            type: 'source',
            axis: Axis.h,
            line: Line.horizontal(100, [50, 150])
          },
          matchingMagnet: {
            type: 'canvas',
            axis: Axis.h,
            line: Line.horizontal(100, [0, 200])
          }
        }
      ];

      snapMarkers.set(testMarkers);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    test('should clear markers', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const snapMarkers = SnapMarkers.get(diagram);

      const testMarkers: SnapMarker[] = [
        {
          line: Line.horizontal(100, [0, 200]),
          selfMagnet: {
            type: 'source',
            axis: Axis.h,
            line: Line.horizontal(100, [50, 150])
          },
          matchingMagnet: {
            type: 'node',
            axis: Axis.h,
            line: Line.horizontal(100, [0, 200]),
            // @ts-ignore
            node: { id: 'node1' }
          }
        }
      ];

      snapMarkers.set(testMarkers);
      expect(snapMarkers.markers).toHaveLength(1);

      snapMarkers.clear();

      expect(snapMarkers.markers).toEqual([]);
    });

    test('should emit clear event', () => {
      const { diagram } = TestModel.newDiagramWithLayer();
      const snapMarkers = SnapMarkers.get(diagram);

      const listener = vi.fn();
      snapMarkers.on('clear', listener);

      snapMarkers.clear();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
