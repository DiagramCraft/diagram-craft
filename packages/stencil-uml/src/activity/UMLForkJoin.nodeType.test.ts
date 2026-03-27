import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { UMLForkJoinNodeDefinition } from '@diagram-craft/stencil-uml/activity/UMLForkJoin.nodeType';

describe('UMLForkJoin', () => {
  test('locks horizontal resize and exposes side edge and point anchors', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const node = layer.addNode({
      type: 'umlForkJoin',
      bounds: { x: 10, y: 20, w: 5, h: 50, r: 0 }
    });

    const anchors = new UMLForkJoinNodeDefinition().getAnchors(node);

    expect(node.renderProps.capabilities.resizable.horizontal).toBe(false);
    expect(anchors.map(a => a.id)).toEqual([
      'left-edge',
      'right-edge',
      'l',
      'r'
    ]);
    expect(anchors[0]).toMatchObject({ type: 'edge', start: { x: 0, y: 0 }, end: { x: 0, y: 1 } });
    expect(anchors[1]).toMatchObject({ type: 'edge', start: { x: 1, y: 0 }, end: { x: 1, y: 1 } });
  });
});
