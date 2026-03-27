import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { UMLActivityNodeDefinition } from '@diagram-craft/stencil-uml/activity/UMLActivity.nodeType';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';

describe('UMLActivity', () => {
  test('registers as a child-capable rounded activity node with a type selector', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const activity = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 }
    });

    const definition = new UMLActivityNodeDefinition();
    const propertyLabels = definition.getCustomPropertyDefinitions(activity).entries.map(p =>
      'label' in p ? p.label : undefined
    );

    expect(activity.getDefinition().name).toBe('UML Activity');
    expect(activity.getDefinition().hasFlag(NodeFlags.ChildrenAllowed)).toBe(true);
    expect(activity.getDefinition().hasFlag(NodeFlags.ChildrenCanHaveLayout)).toBe(false);
    expect(activity.renderProps.custom.umlActivity.type).toBe('activity');
    expect(propertyLabels.filter(Boolean)).toEqual(['Type']);
  });

  test('uses a rounded rectangle bounding path', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const activity = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 }
    });

    const path = new UMLActivityNodeDefinition().getBoundingPathBuilder(activity).getPaths().asSvgPath();

    expect(path).toBe(
      'M 28,20 L 112,20 A 18,18,0,0,1,130,38 L 130,62 A 18,18,0,0,1,112,80 L 28,80 A 18,18,0,0,1,10,62 L 10,38 A 18,18,0,0,1,28,20'
    );
  });

  test('uses a convex pentagon path for send signal action', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const activity = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 },
      props: {
        custom: {
          umlActivity: {
            type: 'send-signal-action'
          }
        }
      }
    });

    const path = new UMLActivityNodeDefinition().getBoundingPathBuilder(activity).getPaths().asSvgPath();

    expect(path).toBe('M 10,20 L 112,20 L 130,50 L 112,80 L 10,80 L 10,20');
  });

  test('uses a concave arrow path for accept event action', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const activity = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 },
      props: {
        custom: {
          umlActivity: {
            type: 'accept-event-action'
          }
        }
      }
    });

    const path = new UMLActivityNodeDefinition().getBoundingPathBuilder(activity).getPaths().asSvgPath();

    expect(path).toBe('M 10,20 L 130,20 L 130,80 L 10,80 L 28,50 L 10,20');
  });

  test('uses an hourglass path for wait time action', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const activity = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 },
      props: {
        custom: {
          umlActivity: {
            type: 'wait-time-action'
          }
        }
      }
    });

    const path = new UMLActivityNodeDefinition().getBoundingPathBuilder(activity).getPaths().asSvgPath();

    expect(path).toBe('M 10,20 L 130,20 L 70,50 L 130,80 L 10,80 L 70,50 L 10,20');
  });

  test('adjusts side anchors for special activity shapes', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const sendSignal = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 },
      props: { custom: { umlActivity: { type: 'send-signal-action' } } }
    });
    const acceptEvent = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 },
      props: { custom: { umlActivity: { type: 'accept-event-action' } } }
    });
    const waitTime = layer.addNode({
      type: 'umlActivity',
      bounds: { x: 10, y: 20, w: 120, h: 60, r: 0 },
      props: { custom: { umlActivity: { type: 'wait-time-action' } } }
    });

    const sendSignalAnchors = new UMLActivityNodeDefinition().getAnchors(sendSignal);
    const acceptEventAnchors = new UMLActivityNodeDefinition().getAnchors(acceptEvent);
    const waitTimeAnchors = new UMLActivityNodeDefinition().getAnchors(waitTime);

    expect(sendSignalAnchors.map(a => a.id)).toEqual(['1', '2', '3', '4', 'c']);
    expect(acceptEventAnchors.map(a => a.id)).toEqual(['1', '2', '3', '4', 'c']);
    expect(waitTimeAnchors.map(a => a.id)).toEqual(['1', '2', 'c']);
    expect(acceptEventAnchors.find(a => a.id === '4')?.start).toEqual({ x: 0.15, y: 0.5 });
  });
});
