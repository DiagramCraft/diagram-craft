import { describe, expect, test } from 'vitest';
import { makeIsometricTransform } from './isometric';
import type { NodePropsForRendering } from '@diagram-craft/model/diagramNode';

describe('makeIsometricTransform', () => {
  test('creates transform with default isometric properties', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const props = {
      effects: {
        isometric: {
          tilt: 0.5,
          rotation: 45
        }
      }
    } as NodePropsForRendering;

    const transform = makeIsometricTransform(bounds, props);

    expect(transform.svgForward()).toBeDefined();
    expect(transform.svgReverse()).toBeDefined();
    expect(typeof transform.svgForward()).toBe('string');
    expect(typeof transform.svgReverse()).toBe('string');
    expect(transform.point({ x: 50, y: 50 })).toBeDefined();
  });

  test('transforms point correctly with isometric projection', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const props = {
      effects: {
        isometric: {
          tilt: 1,
          rotation: 0
        }
      }
    } as NodePropsForRendering;

    const transform = makeIsometricTransform(bounds, props);
    const transformedPoint = transform.point({ x: 50, y: 50 });

    expect(transformedPoint.x).toBe(50);
    expect(transformedPoint.y).toBe(50);
  });
});
