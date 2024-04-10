import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { DiagramNode } from '@diagram-craft/model';
import { BaseShape, BaseShapeBuildProps } from '../shape/BaseShape';
import { PathBuilder, Point, unitCoordinateSystem } from '@diagram-craft/geometry';
import { ShapeBuilder } from '../shape/ShapeBuilder';

export class RectNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'rect', displayName = 'Rectangle') {
    super(name, displayName, () => new RectComponent(this));
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

class RectComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);
  }
}
