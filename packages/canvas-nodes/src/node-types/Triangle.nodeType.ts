import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseShape, BaseShapeBuildProps } from '@diagram-craft/canvas/shape/BaseShape';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class TriangleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('triangle', 'Triangle', TriangleComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));
    pathBuilder.close();

    return pathBuilder;
  }
}

class TriangleComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new TriangleNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);
  }
}
