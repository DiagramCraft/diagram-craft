import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';

describe('UMLArtifactNodeDefinition', () => {
  test('registers umlArtifact with icon-related custom properties', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const artifact = layer.addNode({
      type: 'umlArtifact',
      bounds: { x: 0, y: 0, w: 80, h: 100, r: 0 }
    });

    const properties = artifact.getDefinition().getCustomPropertyDefinitions(artifact).entries;

    expect(properties.map(property => property.label)).toEqual([
      'Icon',
      'Icon Position',
      'Icon Size',
      'Icon Color',
      'Padding X',
      'Padding Y'
    ]);
  });
});
