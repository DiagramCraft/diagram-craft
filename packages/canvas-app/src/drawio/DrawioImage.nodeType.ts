import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class DrawioImageNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'drawioImage', displayName = 'DrawIO Image') {
    super(name, displayName, DrawioImageComponent);
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

class DrawioImageComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DrawioImageNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());

    const bounds = props.node.bounds;

    shapeBuilder.text(
      this,
      '1',
      props.nodeProps.text,
      props.nodeProps.drawio?.textPosition
        ? {
            x: props.nodeProps.drawio.textPosition === 'right' ? bounds.x + bounds.w : bounds.x,
            y: props.nodeProps.drawio.textPosition === 'bottom' ? bounds.y + bounds.h : bounds.y,
            w: props.nodeProps.drawio.textPosition === 'right' ? 200 : bounds.w,
            h: bounds.h,
            r: 0
          }
        : {
            x: bounds.x - 50,
            y: bounds.y + bounds.h,
            w: bounds.w + 100,
            h: 100,
            r: 0
          },
      undefined
    );
  }
}
