import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

type ActorType = 'regular' | 'business';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlActor?: {
        type?: ActorType;
      };
    }
  }
}

registerCustomNodeDefaults('umlActor', {
  type: 'regular' as ActorType
});

export class UMLActorNodeDefinition extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlActor', 'UML Actor');
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [
      CustomProperty.node.select(node, 'Type', 'custom.umlActor.type', [
        { value: 'regular', label: 'Regular' },
        { value: 'business', label: 'Business Actor' }
      ])
    ]);
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.ellipse(w / 2, h / 8, w / 4, h / 8);
    b.fillAndStroke();

    b.path(w / 2, h / 4).line(w / 2, (2 * h) / 3);
    b.path(w / 2, h / 3).line(0, h / 3);
    b.path(w / 2, h / 3).line(w, h / 3);
    b.path(w / 2, (2 * h) / 3).line(0, h);
    b.path(w / 2, (2 * h) / 3).line(w, h);
    b.fillAndStroke();

    const type = props.nodeProps.custom.umlActor?.type ?? 'regular';

    if (type === 'business') {
      const bounds = props.node.bounds;
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 8;
      const rx = bounds.w / 4;
      const ry = bounds.h / 8;

      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const x1 = cx + rx * Math.sin(toRad(60));
      const y1 = cy - ry * Math.cos(toRad(60));
      const x2 = cx + rx * Math.sin(toRad(160));
      const y2 = cy - ry * Math.cos(toRad(160));

      shapeBuilder.add(
        svg.path({
          'd': `M ${x1} ${y1} L ${x2} ${y2}`,
          'fill': 'none',
          'stroke': props.nodeProps.stroke.color,
          'stroke-width': props.nodeProps.stroke.width
        })
      );
    }

    shapeBuilder.text(props.cmp, '1');
  }
}
