import { ShapeNodeDefinition } from '../shapeNodeDefinition.ts';
import { DiagramNode } from '@diagram-craft/model';
import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import { PathBuilder, Point, unitCoordinateSystem } from '@diagram-craft/geometry';

export class DiamondNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('diamond', 'Diamond', () => new DiamondComponent(this));
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(0, 1));
    pathBuilder.lineTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(0, -1));
    pathBuilder.lineTo(Point.of(-1, 0));
    pathBuilder.lineTo(Point.of(0, 1));

    return pathBuilder;
  }
}

class DiamondComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);
  }
}
