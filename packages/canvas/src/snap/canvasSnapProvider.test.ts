import { describe, expect, test } from 'vitest';
import { CanvasSnapProvider } from './canvasSnapProvider';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';
import type { MatchingMagnetPair } from './snapManager';

describe('CanvasSnapProvider', () => {
  test('should generate vertical and horizontal center magnets for standard canvas', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    diagram.canvas = { x: 0, y: 0, w: 400, h: 300 };
    const provider = new CanvasSnapProvider(diagram);
    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    // Act
    const magnets = provider.getMagnets(box);

    // Verify
    expect(magnets).toHaveLength(2);

    // Find vertical center magnet
    const verticalCenter = magnets.find(m => m.axis === Axis.v);
    expect(verticalCenter!.type).toBe('canvas');
    expect(Line.isVertical(verticalCenter!.line)).toBe(true);
    expect(verticalCenter!.line.from.x).toBe(200);

    // Find horizontal center magnet
    const horizontalCenter = magnets.find(m => m.axis === Axis.h);
    expect(horizontalCenter!.type).toBe('canvas');
    expect(Line.isHorizontal(horizontalCenter!.line)).toBe(true);
    expect(horizontalCenter!.line.from.y).toBe(150);
  });

  test('should work with different canvas sizes', () => {
    // Setup - large canvas
    const diagram = TestModel.newDiagram();
    diagram.canvas = { x: 0, y: 0, w: 1000, h: 800 };
    const provider = new CanvasSnapProvider(diagram);
    const box = { x: 0, y: 0, w: 50, h: 50, r: 0 };

    // Act
    const magnets = provider.getMagnets(box);

    // Verify centers are calculated correctly
    const verticalCenter = magnets.find(m => m.axis === Axis.v);
    const horizontalCenter = magnets.find(m => m.axis === Axis.h);

    expect(verticalCenter!.line.from.x).toBe(500); // 1000 / 2
    expect(horizontalCenter!.line.from.y).toBe(400); // 800 / 2
  });

  test('should create proper highlights for canvas snaps', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    diagram.canvas = { x: 0, y: 0, w: 400, h: 300 };
    const provider = new CanvasSnapProvider(diagram);
    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    // Create a mock matching magnet pair
    const canvasCenterMagnet = {
      line: Line.vertical(200, Range.of(0, 300)),
      axis: Axis.v,
      type: 'canvas' as const
    };
    const sourceMagnet = {
      line: Line.vertical(100, Range.of(50, 100)),
      axis: Axis.v,
      type: 'source' as const
    };
    const matchingPair: MatchingMagnetPair<'canvas'> = {
      self: sourceMagnet,
      matching: canvasCenterMagnet,
      distance: -100
    };

    // Act
    const highlight = provider.highlight(box, matchingPair, Axis.v);

    // Verify
    expect(highlight).toBeDefined();
    expect(highlight.line).toEqual(canvasCenterMagnet.line);
    expect(highlight.matchingMagnet).toBe(canvasCenterMagnet);
    expect(highlight.selfMagnet).toBe(sourceMagnet);
  });

  test('magnet axis', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    diagram.canvas = { x: 0, y: 0, w: 400, h: 300 };
    const provider = new CanvasSnapProvider(diagram);
    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    const magnets = provider.getMagnets(box);
    for (const m of magnets) {
      if (Line.isHorizontal(m.line)) {
        expect(m.axis).toBe('h');
      } else {
        expect(m.axis).toBe('v');
      }
    }
  });
});
