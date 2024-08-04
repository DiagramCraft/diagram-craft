import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { coalesce } from '@diagram-craft/utils/strings';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { deepClone } from '@diagram-craft/utils/object';
import { DeepWriteable } from '@diagram-craft/utils/types';

declare global {
  interface CustomNodeProps {
    umlLifeline?: {
      participant?: string;
    };
  }
}

registerCustomNodeDefaults('umlLifeline', { participant: '' });

export class UmlLifeline extends SimpleShapeNodeDefinition {
  constructor(private readonly registry: NodeDefinitionRegistry) {
    super('umlLifeline', 'UML Lifeline');
    this.capabilities['connect-to-boundary'] = false;
    this.capabilities['anchors-configurable'] = false;
  }

  getShapeAnchors(node: DiagramNode): Anchor[] {
    // TODO: This must be read from the file
    const participantHeight = 40;

    return [
      {
        id: 'lifeline',
        type: 'edge',
        start: { x: 0.5, y: participantHeight / node.bounds.h },
        end: { x: 0.5, y: 1 },
        clip: false,
        directions: [
          [0, 0],
          [Math.PI, Math.PI]
        ]
      }
    ];
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    // TODO: This must be read from the file
    const participantHeight = 40;

    const b = shapeBuilder.buildBoundary();
    b.path(w / 2, participantHeight).line(w / 2, h);
    b.stroke(
      {
        ...props.nodeProps.stroke,
        pattern: 'DASHED',
        patternSpacing: 40,
        patternSize: 40
      },
      true
    );

    const participant = coalesce(props.node.renderProps.custom.umlLifeline?.participant, 'rect')!;

    const shape = this.registry.get(participant)!;
    if (!shape) VERIFY_NOT_REACHED();

    const nodeComponent = (shape as ShapeNodeDefinition).component!;

    const participantProps = deepClone(props.nodeProps) as DeepWriteable<NodePropsForRendering>;

    const node = new DiagramNode(
      `${props.node.id}---participant`,
      shape.type,
      {
        x: props.node.bounds.x,
        y: props.node.bounds.y,
        w: props.node.bounds.w,
        h: participantHeight,
        r: 0
      },
      props.node.diagram,
      props.node.layer,
      participantProps,
      {},
      { text: '' }
    );

    shapeBuilder.add(
      props.cmp.subComponent(() => new nodeComponent(shape as ShapeNodeDefinition), {
        mode: 'canvas',
        element: node,
        actionMap: props.actionMap,
        onDoubleClick: shapeBuilder.makeOnDblclickHandle(),
        onMouseDown: (_id, coord, modifiers) => {
          props.childProps.onMouseDown?.(props.node.id, coord, modifiers);
        },
        applicationTriggers: props.applicationTriggers,
        tool: props.tool
      })
    );

    shapeBuilder.text(props.cmp, '1', props.node.getText(), props.node.renderProps.text, {
      ...props.node.bounds,
      h: participantHeight
    });
  }
}
