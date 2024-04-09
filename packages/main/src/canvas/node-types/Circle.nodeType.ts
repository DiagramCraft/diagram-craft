import { ShapeNodeDefinition } from '../shapeNodeDefinition.ts';
import { DiagramNode } from '@diagram-craft/model';
import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import { PathBuilder, Point, unitCoordinateSystem } from '@diagram-craft/geometry';

export class CircleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('circle', 'Circle', () => new CircleComponent(this));
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const b = new PathBuilder(unitCoordinateSystem(def.bounds));
    b.moveTo(Point.of(0, -1));
    b.arcTo(Point.of(1, 0), 0.5, 0.5);
    b.arcTo(Point.of(0, 1), 0.5, 0.5);
    b.arcTo(Point.of(-1, 0), 0.5, 0.5);
    b.arcTo(Point.of(0, -1), 0.5, 0.5);
    return b;
  }
}

class CircleComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);
  }
}
