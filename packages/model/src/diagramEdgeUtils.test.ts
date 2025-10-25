import { describe, expect, test } from 'vitest';
import { applyLineHops, clipPath } from './diagramEdgeUtils';
import { TestModel } from './test-support/testModel';
import { Path } from '@diagram-craft/geometry/path';
import { FreeEndpoint } from './endpoint';
import { UnitOfWork } from './unitOfWork';

describe('diagramEdgeUtils', () => {
  describe('clipPath', () => {
    test('returns original path when endpoints are free and no arrows', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      UnitOfWork.execute(diagram, uow => {
        edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
        edge.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
      });

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 100]]);
      const result = clipPath(path, edge, undefined, undefined);

      expect(result).toBeDefined();
      expect(result?.start).toEqual({ x: 0, y: 0 });
    });

    test('clips path with start arrow', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      UnitOfWork.execute(diagram, uow => {
        edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
        edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
      });

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const startArrow = { height: 10, shortenBy: 5 };

      const result = clipPath(path, edge, startArrow, undefined);

      expect(result).toBeDefined();
      expect(result?.start.x).toBeGreaterThan(0);
    });

    test('clips path with end arrow', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      UnitOfWork.execute(diagram, uow => {
        edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
        edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
      });

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const endArrow = { height: 10, shortenBy: 5 };

      const result = clipPath(path, edge, undefined, endArrow);

      expect(result).toBeDefined();
      expect(result?.end.x).toBeLessThan(100);
    });
  });

  describe('applyLineHops', () => {
    test('returns original path when no intersections', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 100]]);
      const result = applyLineHops(path, edge, undefined, undefined, []);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path);
    });

    test('returns original path when lineHops type defaults to none', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 100]]);
      const intersections = [{ point: { x: 50, y: 50 }, type: 'below' as const }];

      const result = applyLineHops(path, edge, undefined, undefined, intersections);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path);
    });

    test('filters out intersections outside path bounds', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const intersections = [
        { point: { x: -50, y: 0 }, type: 'below' as const },
        { point: { x: 150, y: 0 }, type: 'below' as const }
      ];

      const result = applyLineHops(path, edge, undefined, undefined, intersections);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path);
    });

    test('filters intersections near arrow positions', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      const edge = layer.addEdge();

      const path = new Path({ x: 0, y: 0 }, [['L', 100, 0]]);
      const startArrow = { height: 20 };
      const endArrow = { height: 20 };

      const intersections = [
        { point: { x: 15, y: 0 }, type: 'below' as const },
        { point: { x: 85, y: 0 }, type: 'below' as const }
      ];

      const result = applyLineHops(path, edge, startArrow, endArrow, intersections);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(path);
    });
  });
});
