import { expect, test, describe } from 'vitest';
import { NodeDef, ResolvedNodeDef } from './diagram.ts';
import { Point } from '../geometry.ts';

describe('NodeDef', () => {
  test('transform rotate', () => {
    const node1: ResolvedNodeDef = {
      type: 'node',
      nodeType: 'a',
      id: '1',
      children: [],
      pos: { x: 0, y: 0 },
      size: { w: 100, h: 100 },
      rotation: 0
    };

    const node2: ResolvedNodeDef = {
      type: 'node',
      nodeType: 'a',
      id: '2',
      children: [],
      pos: { x: 100, y: 100 },
      size: { w: 100, h: 100 },
      rotation: 0
    };

    const before = { pos: { x: 0, y: 0 }, size: { w: 200, h: 200 }, rotation: 0 };
    const after = { pos: { x: 0, y: 0 }, size: { w: 200, h: 200 }, rotation: 90 };
    NodeDef.transform(node1, before, after);
    NodeDef.transform(node2, before, after);

    expect(node1.rotation).toStrictEqual(90);
    expect(node1.pos).toStrictEqual({ x: 100, y: 0 });
    expect(node1.size).toStrictEqual({ w: 100, h: 100 });

    expect(node2.rotation).toStrictEqual(90);
    expect(node2.pos).toStrictEqual({ x: 0, y: 100 });
    expect(node2.size).toStrictEqual({ w: 100, h: 100 });
  });

  test('transform rotate - inverse', () => {
    const node1: ResolvedNodeDef = {
      type: 'node',
      nodeType: 'a',
      id: '1',
      children: [],
      pos: { x: 10, y: 10 },
      size: { w: 100, h: 100 },
      rotation: 0
    };

    const node2: ResolvedNodeDef = {
      type: 'node',
      nodeType: 'a',
      id: '2',
      children: [],
      pos: { x: 100, y: 100 },
      size: { w: 100, h: 100 },
      rotation: 0
    };

    const before = { pos: { x: 10, y: 10 }, size: { w: 200, h: 300 }, rotation: 0 };
    const after = { pos: { x: 10, y: 10 }, size: { w: 200, h: 300 }, rotation: 30 };
    NodeDef.transform(node1, before, after);
    NodeDef.transform(node2, before, after);

    NodeDef.transform(node1, after, before);
    NodeDef.transform(node2, after, before);

    node1.pos = Point.round(node1.pos);
    node2.pos = Point.round(node2.pos);

    expect(node1.rotation).toStrictEqual(0);
    expect(node1.pos).toStrictEqual({ x: 10, y: 10 });
    expect(node1.size).toStrictEqual({ w: 100, h: 100 });

    expect(node2.rotation).toStrictEqual(0);
    expect(node2.pos).toStrictEqual({ x: 100, y: 100 });
    expect(node2.size).toStrictEqual({ w: 100, h: 100 });
  });
});
