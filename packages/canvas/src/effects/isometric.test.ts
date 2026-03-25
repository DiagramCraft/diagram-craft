import { describe, expect, test } from 'vitest';
import { isometricBaseShape, makeIsometricTransform } from './isometric';
import type { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import type { VNode } from '../component/vdom';

const createProps = (
  overrides: Partial<NonNullable<NodePropsForRendering['effects']>['isometric']> = {}
) =>
  ({
    effects: {
      isometric: {
        enabled: true,
        shape: 'rect',
        size: 10,
        color: '#eeeeee',
        strokeColor: '#000000',
        strokeEnabled: false,
        tilt: 0.6,
        rotation: 45,
        ...overrides
      }
    }
  }) as NodePropsForRendering;

const isElementVNode = (
  node: string | VNode
): node is Extract<VNode, { type: 's' | 'h' | 'c' }> =>
  typeof node !== 'string' && node.type !== 't' && node.type !== 'r';

describe('makeIsometricTransform', () => {
  test('creates SVG transforms and moves off-center points', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const props = createProps({ tilt: 0.5, rotation: 45 });

    const transform = makeIsometricTransform(bounds, props);
    const transformedPoint = transform.point({ x: 20, y: 80 });

    expect(typeof transform.svgForward()).toBe('string');
    expect(typeof transform.svgReverse()).toBe('string');
    expect(transformedPoint).not.toEqual({ x: 20, y: 80 });
  });

  test('keeps the center point fixed for identity-like transform', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const props = createProps({ tilt: 1, rotation: 0 });

    const transform = makeIsometricTransform(bounds, props);
    const transformedPoint = transform.point({ x: 50, y: 50 });

    expect(transformedPoint.x).toBe(50);
    expect(transformedPoint.y).toBe(50);
  });

  test('forward and reverse transforms cancel each other out for representative points', () => {
    const bounds = { x: 10, y: 20, w: 120, h: 80, r: 0 };
    const props = createProps({ tilt: 0.35, rotation: 30 });
    const transform = makeIsometricTransform(bounds, props);

    const svgMatrix = (matrix: string): [number, number, number, number, number, number] => {
      const match = /^matrix\(([^)]+)\)$/.exec(matrix);
      expect(match).not.toBeNull();
      const valuesStr = match?.[1];
      expect(valuesStr).toBeDefined();
      const values = valuesStr!.split(',').map(Number);
      expect(values).toHaveLength(6);
      return [
        values[0]!,
        values[1]!,
        values[2]!,
        values[3]!,
        values[4]!,
        values[5]!
      ];
    };

    const applyMatrix = (
      matrix: [number, number, number, number, number, number],
      point: { x: number; y: number }
    ) => ({
      x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
      y: matrix[1] * point.x + matrix[3] * point.y + matrix[5]
    });

    const reverseMatrix = svgMatrix(transform.svgReverse());
    const samplePoints = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      { x: bounds.x + 17, y: bounds.y + 29 }
    ];

    for (const point of samplePoints) {
      const restored = applyMatrix(reverseMatrix, transform.point(point));
      expect(restored.x).toBeCloseTo(point.x, 4);
      expect(restored.y).toBeCloseTo(point.y, 4);
    }
  });
});

describe('isometricBaseShape', () => {
  test('returns no extra nodes when the base shape is disabled', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const props = createProps({ shape: 'none' });

    expect(isometricBaseShape(bounds, makeIsometricTransform(bounds, props), props)).toEqual([]);
  });

  test('builds a base rectangle plus two side faces', () => {
    const bounds = { x: 5, y: 10, w: 80, h: 60, r: 0 };
    const props = createProps({ strokeEnabled: true, strokeColor: '#123456', size: 14 });
    const nodes = isometricBaseShape(bounds, makeIsometricTransform(bounds, props), props);

    expect(nodes).toHaveLength(2);

    const baseRect = nodes[0]!;
    const sideFaces = nodes[1]!;
    expect(baseRect.tag).toBe('rect');
    expect(baseRect.data.stroke).toBe('#123456');
    expect(baseRect.data.fill).toBe('#eeeeee');

    expect(sideFaces.tag).toBe('g');
    expect(sideFaces.children).toHaveLength(2);
    expect(sideFaces.children.every(isElementVNode)).toBe(true);

    const faces = sideFaces.children.filter(isElementVNode);
    expect(faces.every(child => child.tag === 'path')).toBe(true);

    for (const face of faces) {
      expect(face.data.stroke).toBe('#123456');
      expect(face.data.fill).toBe('#eeeeee');
      expect(typeof face.data.d).toBe('string');
      expect((face.data.d as string).startsWith('M ')).toBe(true);
      expect((face.data.d as string).includes(' Z')).toBe(true);
    }
  });

  test('omits stroke when stroke rendering is disabled', () => {
    const bounds = { x: 0, y: 0, w: 40, h: 30, r: 0 };
    const props = createProps({ strokeEnabled: false });
    const nodes = isometricBaseShape(bounds, makeIsometricTransform(bounds, props), props);

    const baseRect = nodes[0]!;
    const sideFaces = nodes[1]!;
    expect(baseRect.data.stroke).toBe('none');
    expect(sideFaces.children.every(isElementVNode)).toBe(true);
    expect(sideFaces.children.filter(isElementVNode).every(child => child.data.stroke === 'none')).toBe(
      true
    );
  });
});
