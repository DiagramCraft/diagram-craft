import {
  BaseNodeComponent,
  BaseShapeBuildProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export class TextNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('text', 'Test', TextComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {
      style: 'default-text',

      // TODO: Remove all of this
      stroke: {
        enabled: false
      },
      fill: {
        enabled: false
      },
      text: {
        align: 'left',
        text: 'Text',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    };
  }

  getDefaultConfig(): { size: Extent } {
    return { size: { w: 25, h: 10 } };
  }
}

class TextComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new TextNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this, '1', props.nodeProps.text, props.node.bounds, (size: Extent) => {
      const width = size.w;
      const height = size.h;

      UnitOfWork.execute(props.node.diagram!, uow => {
        props.node.setBounds(
          {
            ...props.node.bounds,
            h: height,
            w: width
          },
          uow
        );
      });

      props.node.diagram!.selectionState.rebaseline();
    });
  }
}
