import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import {
  getCollaborationSeparatorChord,
  UMLCollaborationNodeDefinition
} from '@diagram-craft/stencil-uml/composite/UMLCollaboration.nodeType';
import { LayoutCapableShapeNodeDefinitionInterface } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';

const createCollaboration = async (size = 24, titleHeight?: number) => {
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  await registerUMLNodes(diagram.document.registry.nodes);

  return layer.addNode({
    type: 'umlCollaboration',
    bounds: { x: 10, y: 20, w: 180, h: 100, r: 0 },
    props: {
      custom: {
        umlCollaboration: {
          size,
          titleHeight
        }
      }
    }
  });
};

const getContainerPadding = (node: Awaited<ReturnType<typeof createCollaboration>>) =>
  (node.getDefinition() as LayoutCapableShapeNodeDefinitionInterface).getContainerPadding(node);

describe('UMLCollaboration', () => {
  test('uses the title size as top container padding', async () => {
    const node = await createCollaboration(28);

    expect(getContainerPadding(node)).toEqual({
      top: 28,
      right: 0,
      bottom: 0,
      left: 0
    });
  });

  test('prefers explicit title height over measured size', async () => {
    const node = await createCollaboration(28, 36);

    expect(getContainerPadding(node)).toEqual({
      top: 36,
      right: 0,
      bottom: 0,
      left: 0
    });
  });

  test('collapses to the title band height', async () => {
    const node = await createCollaboration(28);
    const def = new UMLCollaborationNodeDefinition();

    expect(def['getCollapsedBounds'](undefined, node)).toEqual({
      x: 10,
      y: 20,
      w: 180,
      h: 28,
      r: 0
    });
  });

  test('builds an elliptical boundary path for a non-square node', async () => {
    const node = await createCollaboration(24);
    const def = new UMLCollaborationNodeDefinition();

    const path = def.getBoundingPathBuilder(node).getPaths().asSvgPath();

    expect(path).toBe(
      'M 100,20 A 90,50,0,0,1,190,70 A 90,50,0,0,1,100,120 A 90,50,0,0,1,10,70 A 90,50,0,0,1,100,20'
    );
  });

  test('clips the separator line to the ellipse chord', async () => {
    const node = await createCollaboration(24);

    const chord = getCollaborationSeparatorChord(node, 24);

    expect(chord.y).toBe(44);
    expect(chord.x1).toBeGreaterThan(10);
    expect(chord.x2).toBeLessThan(190);
    expect(chord.x1).toBeCloseTo(23.13, 2);
    expect(chord.x2).toBeCloseTo(176.87, 2);
  });
});
