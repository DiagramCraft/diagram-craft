import { describe, expect, test } from 'vitest';
import { Point } from '@diagram-craft/geometry/point';
import type { Anchor } from '@diagram-craft/model/anchor';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { RectNodeDefinition } from '../node-types/Rect.nodeType';
import { projectToPointHandle } from './anchorHandleDragSource';

class NoBoundaryRectNodeDefinition extends RectNodeDefinition {
  constructor() {
    super('no-boundary-rect', 'No Boundary');
    this.setFlags({
      [NodeFlags.AnchorsBoundary]: false
    });
  }
}

const withEdgeAnchor = (node: DiagramNode) => {
  const anchors = [
    {
      id: 'top-edge',
      type: 'edge',
      start: Point.of(0, 0),
      end: Point.of(1, 0),
      normal: -Math.PI / 2,
      isPrimary: true,
      clip: false
    },
    { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
  ] satisfies Anchor[];

  Object.defineProperty(node, 'anchors', {
    configurable: true,
    get: () => anchors
  });
  node.getAnchor = (anchor: string) => anchors.find(a => a.id === anchor) ?? anchors[0]!;
  return node;
};

describe('resolveProjectedSourceHandle', () => {
  test('projects to the closest edge anchor when the node exposes edge anchors', () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 10, y: 20, w: 100, h: 60, r: 0 }
      })
    );

    expect(node.anchors.some(anchor => anchor.type === 'edge')).toBe(true);

    const handle = projectToPointHandle(
      node,
      { x: 65, y: 24 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );

    expect(handle?.type).toBe('edge-anchor');
    expect(handle?.point).toEqual({ x: 65, y: 20 });
  });

  test('requires the cursor to be much closer for thin shapes with edge anchors', () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 10, y: 20, w: 5, h: 60, r: 0 }
      })
    );

    const handle = projectToPointHandle(
      node,
      { x: 12.5, y: 24 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );

    expect(handle).toBeUndefined();
  });

  test('still projects edge anchors on thin shapes when the cursor is near the edge', () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 10, y: 20, w: 5, h: 60, r: 0 }
      })
    );

    const handle = projectToPointHandle(
      node,
      { x: 10.5, y: 20.5 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );

    expect(handle?.type).toBe('edge-anchor');
    expect(handle?.point).toEqual({ x: 10.5, y: 20 });
  });

  test('reduces edge-anchor projection distance when zoomed in', () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 10, y: 20, w: 5, h: 60, r: 0 }
      })
    );

    const handleAtDefaultZoom = projectToPointHandle(
      node,
      { x: 10.5, y: 21.2 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      1
    );
    const handleWhenZoomedIn = projectToPointHandle(
      node,
      { x: 10.5, y: 21.2 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      2
    );

    expect(handleAtDefaultZoom?.type).toBe('edge-anchor');
    expect(handleWhenZoomedIn).toBeUndefined();
  });

  test('does not enlarge edge-anchor projection distance when zoomed out', () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 10, y: 20, w: 5, h: 60, r: 0 }
      })
    );

    const handleAtDefaultZoom = projectToPointHandle(
      node,
      { x: 10.5, y: 21.2 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      1
    );
    const handleWhenZoomedOut = projectToPointHandle(
      node,
      { x: 10.5, y: 21.2 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      0.5
    );

    expect(handleAtDefaultZoom?.type).toBe('edge-anchor');
    expect(handleWhenZoomedOut?.type).toBe('edge-anchor');
  });

  test('returns a boundary handle only when meta is active and no edge anchors exist', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({
      type: 'rect',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
      props: {
        anchors: { type: 'none' }
      }
    });

    expect(
      projectToPointHandle(
        node,
        { x: 50, y: 20 },
        {
          shiftKey: false,
          altKey: false,
          metaKey: false,
          ctrlKey: false
        }
      )
    ).toBeUndefined();

    const handle = projectToPointHandle(
      node,
      { x: 50, y: 20 },
      { shiftKey: false, altKey: false, metaKey: true, ctrlKey: false }
    );

    expect(handle?.type).toBe('boundary-point');
    expect(handle?.point).toEqual({ x: 50, y: 0 });
  });

  test('does not return a boundary handle when the node disables boundary anchors', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    diagram.document.registry.nodes.register(new NoBoundaryRectNodeDefinition());

    const node = layer.addNode({
      type: 'no-boundary-rect',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
      props: {
        anchors: { type: 'none' }
      }
    });

    const handle = projectToPointHandle(
      node,
      { x: 50, y: 20 },
      { shiftKey: false, altKey: false, metaKey: true, ctrlKey: false }
    );

    expect(handle).toBeUndefined();
  });
});
