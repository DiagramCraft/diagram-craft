import { describe, expect, test } from 'vitest';
import { GridSnapProvider } from './gridSnapProvider';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';
import type { MatchingMagnetPair } from './snapManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('GridSnapProvider', () => {
  describe('constructor and grid size', () => {
    test('should use diagram grid size when available', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(p => {
          p.grid = { size: 25, enabled: true };
        }, uow)
      );
      const provider = new GridSnapProvider(diagram);

      // Test by examining generated magnets
      const box = { x: 0, y: 0, w: 50, h: 50, r: 0 };
      const magnets = provider.getMagnets(box);

      // Should have magnets at 25-unit intervals
      const verticalMagnets = magnets.filter(m => m.axis === Axis.v);
      expect(verticalMagnets.some(m => m.line.from.x === 0)).toBe(true);
      expect(verticalMagnets.some(m => m.line.from.x === 25)).toBe(true);
      expect(verticalMagnets.some(m => m.line.from.x === 50)).toBe(true);
    });
  });

  describe('static snapPoint', () => {
    test('should snap point to nearest grid intersection', () => {
      expect(GridSnapProvider.snapPoint({ x: 7, y: 13 }, 10)).toEqual({ x: 10, y: 10 });
      expect(GridSnapProvider.snapPoint({ x: 3, y: 7 }, 10)).toEqual({ x: 0, y: 10 });
      expect(GridSnapProvider.snapPoint({ x: 15, y: 25 }, 10)).toEqual({ x: 20, y: 30 });
    });
  });

  describe('getMagnets', () => {
    test('magnet axis', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(p => {
          p.grid = { size: 10, enabled: true };
        }, uow)
      );
      const provider = new GridSnapProvider(diagram);
      const box = { x: 15, y: 25, w: 20, h: 20, r: 0 };

      const magnets = provider.getMagnets(box);
      for (const m of magnets) {
        if (Line.isHorizontal(m.line)) {
          expect(m.axis).toBe('h');
        } else {
          expect(m.axis).toBe('v');
        }
      }
    });

    test('should generate grid magnets around a simple box', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(p => {
          p.grid = { size: 10, enabled: true };
        }, uow)
      );
      const provider = new GridSnapProvider(diagram);

      // Box from (15, 25) to (35, 45) - spans grid lines at 10, 20, 30, 40
      const box = { x: 15, y: 25, w: 20, h: 20, r: 0 };

      // Act
      const magnets = provider.getMagnets(box);

      // Verify vertical magnets
      const verticalMagnets = magnets.filter(m => m.axis === Axis.v);
      expect(verticalMagnets).toHaveLength(4); // x=10, x=20, x=30, x=40 = 4 lines

      const xPositions = verticalMagnets.map(m => m.line.from.x).sort((a, b) => a - b);
      expect(xPositions).toEqual([10, 20, 30, 40]);

      // Verify horizontal magnets
      const horizontalMagnets = magnets.filter(m => m.axis === Axis.h);
      expect(horizontalMagnets).toHaveLength(4); // y=20, y=30, y=40, y=50 = 4 lines

      const yPositions = horizontalMagnets.map(m => m.line.from.y).sort((a, b) => a - b);
      expect(yPositions).toEqual([20, 30, 40, 50]);
    });

    test('should handle box aligned with grid', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(p => {
          p.grid = { size: 10, enabled: true };
        }, uow)
      );
      const provider = new GridSnapProvider(diagram);

      // Box perfectly aligned with grid
      const box = { x: 20, y: 30, w: 20, h: 10, r: 0 };

      // Act
      const magnets = provider.getMagnets(box);

      // Verify
      const verticalMagnets = magnets.filter(m => m.axis === Axis.v);
      const xPositions = verticalMagnets.map(m => m.line.from.x).sort((a, b) => a - b);
      expect(xPositions).toEqual([20, 30, 40]); // Left edge, middle, right edge

      const horizontalMagnets = magnets.filter(m => m.axis === Axis.h);
      const yPositions = horizontalMagnets.map(m => m.line.from.y).sort((a, b) => a - b);
      expect(yPositions).toEqual([30, 40]); // Top and bottom edges
    });

    test('should handle small box within single grid cell', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(p => {
          p.grid = { size: 20, enabled: true };
        }, uow)
      );
      const provider = new GridSnapProvider(diagram);

      // Small box within grid cell (5, 5) to (15, 10)
      const box = { x: 5, y: 5, w: 10, h: 5, r: 0 };

      // Act
      const magnets = provider.getMagnets(box);

      // Should still generate surrounding grid lines
      const verticalMagnets = magnets.filter(m => m.axis === Axis.v);
      const xPositions = verticalMagnets.map(m => m.line.from.x).sort((a, b) => a - b);
      expect(xPositions).toEqual([0, 20]); // Grid lines at 0 and 20

      const horizontalMagnets = magnets.filter(m => m.axis === Axis.h);
      const yPositions = horizontalMagnets.map(m => m.line.from.y).sort((a, b) => a - b);
      expect(yPositions).toEqual([0, 20]); // Grid lines at 0 and 20
    });
  });

  describe('highlight', () => {
    test('should create highlight for grid line', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const provider = new GridSnapProvider(diagram);
      const box = { x: 50, y: 30, w: 40, h: 20, r: 0 };

      const gridMagnet = {
        line: Line.vertical(60, Range.of(20, 60)),
        axis: Axis.v,
        type: 'grid' as const
      };
      const sourceMagnet = {
        line: Line.vertical(55, Range.of(30, 50)),
        axis: Axis.v,
        type: 'source' as const
      };
      const matchingPair: MatchingMagnetPair<'grid'> = {
        self: sourceMagnet,
        matching: gridMagnet,
        distance: -5
      };

      // Act
      const mark = provider.mark(box, matchingPair, Axis.v);

      // Verify - mark should be vertical line at grid position spanning box height
      expect(mark).toBeDefined();
      expect(Line.isVertical(mark.line)).toBe(true);
      expect(mark.line.from.x).toBe(60); // Grid line position
      expect(mark.line.from.y).toBe(30); // Box top
      expect(mark.line.to.y).toBe(50); // Box bottom
      expect(mark.matchingMagnet).toBe(gridMagnet);
      expect(mark.selfMagnet).toBe(sourceMagnet);
    });
  });

  describe('filterHighlights', () => {
    test('should keep all highlights when no center guides exist', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const provider = new GridSnapProvider(diagram);

      const highlights = [
        {
          line: Line.vertical(60, Range.of(30, 50)),
          matchingMagnet: {
            type: 'grid' as const,
            line: Line.vertical(60, Range.of(20, 60)),
            axis: Axis.v
          },
          selfMagnet: {
            type: 'source' as const,
            line: Line.vertical(55, Range.of(30, 50)),
            axis: Axis.v,
            matchDirection: 'w' as const
          }
        },
        {
          line: Line.horizontal(50, Range.of(20, 80)),
          matchingMagnet: {
            type: 'grid' as const,
            line: Line.horizontal(50, Range.of(10, 90)),
            axis: Axis.h
          },
          selfMagnet: {
            type: 'source' as const,
            line: Line.horizontal(45, Range.of(20, 80)),
            axis: Axis.h,
            matchDirection: 'n' as const
          }
        }
      ];

      // Act
      const filtered = provider.filterMarkers(highlights);

      // Verify - should keep all highlights
      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(highlights);
    });

    test('should handle empty highlights array', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const provider = new GridSnapProvider(diagram);

      // Act
      const filtered = provider.filterMarkers([]);

      // Verify
      expect(filtered).toEqual([]);
    });

    test('should filter both axes independently', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const provider = new GridSnapProvider(diagram);

      const highlights = [
        // Horizontal center
        {
          line: Line.horizontal(50, Range.of(20, 80)),
          matchingMagnet: {
            type: 'grid' as const,
            line: Line.horizontal(50, Range.of(10, 90)),
            axis: Axis.h
          },
          selfMagnet: {
            type: 'source' as const,
            line: Line.horizontal(45, Range.of(20, 80)),
            axis: Axis.h,
            subtype: 'center'
          }
        },
        // Vertical center
        {
          line: Line.vertical(60, Range.of(30, 50)),
          matchingMagnet: {
            type: 'grid' as const,
            line: Line.vertical(60, Range.of(20, 60)),
            axis: Axis.v
          },
          selfMagnet: {
            type: 'source' as const,
            line: Line.vertical(55, Range.of(30, 50)),
            axis: Axis.v,
            subtype: 'center'
          }
        },
        // Horizontal edge (should be filtered)
        {
          line: Line.horizontal(50, Range.of(20, 80)),
          matchingMagnet: {
            type: 'grid' as const,
            line: Line.horizontal(50, Range.of(10, 90)),
            axis: Axis.h
          },
          selfMagnet: {
            type: 'source' as const,
            line: Line.horizontal(40, Range.of(20, 80)),
            axis: Axis.h,
            matchDirection: 'n' as const
          }
        },
        // Vertical edge (should be filtered)
        {
          line: Line.vertical(60, Range.of(30, 50)),
          matchingMagnet: {
            type: 'grid' as const,
            line: Line.vertical(60, Range.of(20, 60)),
            axis: Axis.v
          },
          selfMagnet: {
            type: 'source' as const,
            line: Line.vertical(50, Range.of(30, 50)),
            axis: Axis.v,
            matchDirection: 'w' as const
          }
        }
      ];

      // Act
      const filtered = provider.filterMarkers(highlights);

      // Verify - should keep only center guides
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toBe(highlights[0]); // Horizontal center
      expect(filtered[1]).toBe(highlights[1]); // Vertical center
    });
  });
});
