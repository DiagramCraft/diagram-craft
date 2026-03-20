import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UMLArtifactNodeDefinition } from '@diagram-craft/stencil-uml/deployment/UMLArtifact.nodeType';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';

describe('UMLArtifact', () => {
  test('keeps the folded corner square on a non-square artifact', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const artifact = layer.addNode({
      type: 'umlArtifact',
      bounds: { x: 10, y: 20, w: 100, h: 50, r: 0 }
    });

    const path = new UMLArtifactNodeDefinition().getBoundingPathBuilder(artifact).getPaths().asSvgPath();

    expect(path).toBe('M 10,20 L 97.5,20 L 110,32.5 L 110,70 L 10,70 L 10,20');
  });
});
