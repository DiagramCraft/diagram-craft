import { describe, expect, test } from 'vitest';
import { isNode } from '@diagram-craft/model/diagramElement';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { mustExist } from '@diagram-craft/utils/assert';
import {
  loadUMLStencils,
  registerUMLNodes
} from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { UMLMergeDecisionNodeDefinition } from '@diagram-craft/stencil-uml/activity/UMLMergeDecision.nodeType';

describe('UMLMergeDecision', () => {
  test('registers as a dedicated UML node with diamond vertex and center anchors', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const node = layer.addNode({
      type: 'umlMergeDecision',
      bounds: { x: 10, y: 20, w: 40, h: 40, r: 0 }
    });

    const anchors = new UMLMergeDecisionNodeDefinition().getAnchors(node);

    expect(node.getDefinition().name).toBe('UML Merge / Decision');
    expect(anchors.map(a => a.id)).toEqual(['n', 'e', 's', 'w', 'c']);
    expect(anchors[0]).toMatchObject({ start: { x: 0.5, y: 0 }, type: 'point' });
    expect(anchors[1]).toMatchObject({ start: { x: 1, y: 0.5 }, type: 'point' });
    expect(anchors[2]).toMatchObject({ start: { x: 0.5, y: 1 }, type: 'point' });
    expect(anchors[3]).toMatchObject({ start: { x: 0, y: 0.5 }, type: 'point' });
    expect(anchors[4]).toMatchObject({ start: { x: 0.5, y: 0.5 }, type: 'center' });
  });

  test('loads the activity stencil with the dedicated merge decision node type', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();

    const stencils = await loadUMLStencils(diagram.document.registry);
    const activityPackage = mustExist(stencils.subPackages?.find(p => p.id === 'activity'));
    const stencil = mustExist(
      activityPackage.stencils.find(s => s.id === 'uml-activity-merge-decision')
    );

    const [element] = stencil.forCanvas(diagram.document.registry).elements;

    expect(isNode(element)).toBe(true);
    if (!isNode(element)) throw new Error('Expected node stencil');

    expect(element.nodeType).toBe('umlMergeDecision');
    expect(element.anchors.map(a => a.id)).toEqual(['n', 'e', 's', 'w', 'c']);
  });
});
