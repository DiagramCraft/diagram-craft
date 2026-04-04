import { describe, expect, test } from 'vitest';
import { Point } from '@diagram-craft/geometry/point';
import type { Anchor } from '@diagram-craft/model/anchor';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { _test } from './AnchorHandlesComponent';
import { Zoom } from './zoom';

const createNode = () => {
  const { layer } = TestModel.newDiagramWithLayer();
  return layer.addNode({
    type: 'rect',
    bounds: { x: 10, y: 20, w: 100, h: 60, r: 0 }
  });
};

const withAnchors = (node: DiagramNode, anchors: Anchor[]) => {
  Object.defineProperty(node, 'anchors', {
    configurable: true,
    get: () => anchors
  });
  node.getAnchor = (anchor: string) => anchors.find(a => a.id === anchor) ?? anchors[0]!;
  return node;
};

describe('getPrimaryAnchorHandleVisuals', () => {
  test('renders point anchors as circular handles', () => {
    const node = withAnchors(createNode(), [
      {
        id: 'left',
        type: 'point',
        start: Point.of(0, 0.5),
        normal: Math.PI,
        isPrimary: true,
        clip: false
      }
    ]);

    const visuals = _test.getPrimaryAnchorHandleVisuals(node.anchors[0]!, node, false, new Zoom(1), 4);

    expect(visuals.transformedChildren.some(child => child.type === 's' && child.tag === 'circle')).toBe(
      true
    );
  });

  test('renders edge anchors as spans without circular point handles', () => {
    const node = withAnchors(createNode(), [
      {
        id: 'left-edge',
        type: 'edge',
        start: Point.of(0, 0),
        end: Point.of(0, 1),
        normal: Math.PI,
        isPrimary: true,
        clip: false
      }
    ]);

    const visuals = _test.getPrimaryAnchorHandleVisuals(node.anchors[0]!, node, false, new Zoom(1), 4);

    const lineNodes = visuals.transformedChildren.filter(
      child => child.type === 's' && child.tag === 'line'
    );

    expect(lineNodes.length).toBe(2);
    expect(visuals.transformedChildren.some(child => child.type === 's' && child.tag === 'circle')).toBe(
      false
    );
    expect(lineNodes[0]?.data).toMatchObject({
      x1: 10,
      y1: 20,
      x2: 10,
      y2: 80
    });
  });
});

describe('shouldRenderAnchorHandles', () => {
  test('allows hover handles by default', () => {
    const node = createNode();

    expect(_test.shouldRenderAnchorHandles(node, [])).toBe(true);
  });

  test('requires selection when hover handles are disabled for the node type', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({
      type: 'tableCell',
      bounds: { x: 10, y: 20, w: 100, h: 60, r: 0 }
    });

    expect(_test.shouldRenderAnchorHandles(node, [])).toBe(false);
    expect(_test.shouldRenderAnchorHandles(node, [node])).toBe(true);
  });
});
