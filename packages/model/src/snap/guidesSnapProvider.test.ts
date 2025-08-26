import { describe, expect, test } from 'vitest';
import { GuidesSnapProvider } from './guidesSnapProvider';
import { TestModel } from '../test-support/builder';
import { Axis } from '@diagram-craft/geometry/axis';

describe('GuidesSnapProvider', () => {
  test('should generate magnets for horizontal guides', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    const provider = new GuidesSnapProvider(diagram);

    diagram.addGuide({ type: 'horizontal', position: 100, color: '#ff0000' });
    diagram.addGuide({ type: 'horizontal', position: 200, color: '#00ff00' });

    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    // Act
    const magnets = provider.getMagnets(box);

    // Verify
    expect(magnets).toHaveLength(2);
    expect(magnets[0].type).toBe('guides');
    expect(magnets[0].axis).toBe(Axis.h);
    expect(magnets[0].line.from.y).toBe(100);
    expect(magnets[1].line.from.y).toBe(200);
  });

  test('should generate magnets for vertical guides', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    const provider = new GuidesSnapProvider(diagram);

    diagram.addGuide({ type: 'vertical', position: 150, color: '#ff0000' });
    diagram.addGuide({ type: 'vertical', position: 300, color: '#00ff00' });

    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    // Act
    const magnets = provider.getMagnets(box);

    // Verify
    expect(magnets).toHaveLength(2);
    expect(magnets[0].type).toBe('guides');
    expect(magnets[0].axis).toBe(Axis.v);
    expect(magnets[0].line.from.x).toBe(150);
    expect(magnets[1].line.from.x).toBe(300);
  });

  test('should generate mixed horizontal and vertical magnets', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    const provider = new GuidesSnapProvider(diagram);

    diagram.addGuide({ type: 'horizontal', position: 100, color: '#ff0000' });
    diagram.addGuide({ type: 'vertical', position: 150, color: '#00ff00' });

    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    // Act
    const magnets = provider.getMagnets(box);

    // Verify
    expect(magnets).toHaveLength(2);
    const horizontalMagnet = magnets.find(m => m.axis === Axis.h);
    const verticalMagnet = magnets.find(m => m.axis === Axis.v);

    expect(horizontalMagnet?.line.from.y).toBe(100);
    expect(verticalMagnet?.line.from.x).toBe(150);
  });

  test('should return empty array when no guides exist', () => {
    // Setup
    const diagram = TestModel.newDiagram();
    const provider = new GuidesSnapProvider(diagram);
    const box = { x: 50, y: 50, w: 100, h: 50, r: 0 };

    // Act
    const magnets = provider.getMagnets(box);

    // Verify
    expect(magnets).toHaveLength(0);
  });
});
