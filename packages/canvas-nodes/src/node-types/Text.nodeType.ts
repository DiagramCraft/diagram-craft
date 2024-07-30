import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
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
}

class TextComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new TextNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(
      this,
      '1',
      props.node.getText(),
      props.nodeProps.text,
      props.node.bounds,
      (size: Extent) => {
        const width = size.w;
        const height = size.h;

        // Grow only
        // TODO: Maybe we want to control this somehow
        if (width > props.node.bounds.w || height > props.node.bounds.h) {
          UnitOfWork.execute(props.node.diagram!, uow => {
            props.node.setBounds(
              {
                ...props.node.bounds,
                h: height > props.node.bounds.h ? height : props.node.bounds.h,
                w: width > props.node.bounds.w ? width : props.node.bounds.w
              },
              uow
            );
          });
        }
      }
    );
  }
}
