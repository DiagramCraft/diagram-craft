import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

type UseCaseType = 'regular' | 'business' | 'split';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlUseCase?: {
        type?: UseCaseType;
      };
    }
  }
}

registerCustomNodeDefaults('umlUseCase', {
  type: 'regular' as UseCaseType
});

export class UMLUseCaseNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlUseCase', 'UML Use Case', UMLUseCaseComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(0.5, 0))
      .arcTo(_p(1, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 1), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 0), 0.5, 0.5, 0, 0, 1);
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [
      CustomProperty.node.select(node, 'Type', 'custom.umlUseCase.type', [
        { value: 'regular', label: 'Regular' },
        { value: 'business', label: 'Business Use-Case' },
        { value: 'split', label: 'Split' }
      ])
    ]);
  }
}

class UMLUseCaseComponent extends BaseNodeComponent<UMLUseCaseNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());

    const type = props.nodeProps.custom.umlUseCase.type ?? 'regular';

    if (type === 'business') {
      const bounds = props.node.bounds;
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const rx = bounds.w / 2;
      const ry = bounds.h / 2;

      // Angles measured clockwise from top (0° = 12 o'clock)
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
    } else if (type === 'split') {
      const bounds = props.node.bounds;
      shapeBuilder.add(
        svg.path({
          'd': `M ${bounds.x} ${bounds.y + bounds.h / 2} L ${bounds.x + bounds.w} ${bounds.y + bounds.h / 2}`,
          'fill': 'none',
          'stroke': props.nodeProps.stroke.color,
          'stroke-width': props.nodeProps.stroke.width
        })
      );
    }

    shapeBuilder.text(this);
  }
}
