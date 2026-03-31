import { describe, expect, test } from 'vitest';
import { _test, resolveFillForRendering } from './shapeFill';

describe('shapeFill', () => {
  test('resolves stroke to the current stroke color', () => {
    expect(_test.resolveSpecialColor('stroke', '#336699')).toBe('#336699');
  });

  test('leaves regular colors unchanged', () => {
    expect(_test.resolveSpecialColor('#ff0000', '#336699')).toBe('#ff0000');
  });

  test('resolves fill.color for rendering', () => {
    expect(
      resolveFillForRendering(
        {
          enabled: true,
          type: 'solid',
          color: 'stroke',
          color2: '#ffffff',
          pattern: '',
          image: {
            w: 10,
            h: 10,
            url: '',
            id: '',
            fit: 'fill',
            scale: 1,
            tint: '',
            tintStrength: 0,
            brightness: 1,
            contrast: 1,
            saturation: 1
          },
          gradient: {
            direction: 0,
            type: 'linear'
          }
        },
        '#336699'
      ).color
    ).toBe('#336699');
  });
});
