import { describe, expect, test } from 'vitest';
import { Magnet, type MagnetOfType } from './magnet';
import { Axis } from '@diagram-craft/geometry/axis';
import { Box } from '@diagram-craft/geometry/box';

describe('Magnet.forNode', () => {
  test('should generate center magnets for non-rotated box', () => {
    // Setup
    const box: Box = { x: 10, y: 20, w: 100, h: 80, r: 0 };

    // Act
    const magnets = Magnet.forNode(box);

    // Verify center magnets exist
    const horizontalCenter = magnets.find(
      m => (m as MagnetOfType<'source'>).subtype === 'center' && m.axis === Axis.h
    );
    const verticalCenter = magnets.find(
      m => (m as MagnetOfType<'source'>).subtype === 'center' && m.axis === Axis.v
    );

    expect(horizontalCenter).toBeDefined();
    expect(verticalCenter).toBeDefined();

    // Verify horizontal center line (middle of box vertically)
    expect(horizontalCenter!.line.from.y).toBe(60); // 20 + 80/2
    expect(horizontalCenter!.line.from.x).toBe(10);
    expect(horizontalCenter!.line.to.x).toBe(110); // 10 + 100

    // Verify vertical center line (middle of box horizontally)
    expect(verticalCenter!.line.from.x).toBe(60); // 10 + 100/2
    expect(verticalCenter!.line.from.y).toBe(20);
    expect(verticalCenter!.line.to.y).toBe(100); // 20 + 80
  });

  test('should generate edge magnets for non-rotated box', () => {
    // Setup
    const box: Box = { x: 10, y: 20, w: 100, h: 80, r: 0 };

    // Act
    const magnets = Magnet.forNode(box);

    // Verify we have 6 magnets total (2 center + 4 edges)
    expect(magnets).toHaveLength(6);

    // Find edge magnets by direction
    const northMagnet = magnets.find(m => m.matchDirection === 'n');
    const southMagnet = magnets.find(m => m.matchDirection === 's');
    const westMagnet = magnets.find(m => m.matchDirection === 'w');
    const eastMagnet = magnets.find(m => m.matchDirection === 'e');

    expect(northMagnet).toBeDefined();
    expect(southMagnet).toBeDefined();
    expect(westMagnet).toBeDefined();
    expect(eastMagnet).toBeDefined();

    // Verify north edge (top)
    expect(northMagnet!.axis).toBe(Axis.h);
    expect(northMagnet!.line.from.y).toBe(20);
    expect(northMagnet!.line.from.x).toBe(10);
    expect(northMagnet!.line.to.x).toBe(110);

    // Verify south edge (bottom)
    expect(southMagnet!.axis).toBe(Axis.h);
    expect(southMagnet!.line.from.y).toBe(100); // 20 + 80
    expect(southMagnet!.line.from.x).toBe(10);
    expect(southMagnet!.line.to.x).toBe(110);

    // Verify west edge (left)
    expect(westMagnet!.axis).toBe(Axis.v);
    expect(westMagnet!.line.from.x).toBe(10);
    expect(westMagnet!.line.from.y).toBe(20);
    expect(westMagnet!.line.to.y).toBe(100);

    // Verify east edge (right)
    expect(eastMagnet!.axis).toBe(Axis.v);
    expect(eastMagnet!.line.from.x).toBe(110); // 10 + 100
    expect(eastMagnet!.line.from.y).toBe(20);
    expect(eastMagnet!.line.to.y).toBe(100);
  });

  test('should only generate center magnets for rotated box', () => {
    // Setup - rotated box
    const box: Box = { x: 10, y: 20, w: 100, h: 80, r: Math.PI / 4 }; // 45 degrees

    // Act
    const magnets = Magnet.forNode(box);

    // Verify only 2 center magnets for rotated boxes
    expect(magnets).toHaveLength(2);
    expect(magnets.every(m => (m as MagnetOfType<'source'>).subtype === 'center')).toBe(true);

    // Verify no edge magnets with direction
    const edgeMagnets = magnets.filter(m => m.matchDirection !== undefined);
    expect(edgeMagnets).toHaveLength(0);
  });
});
