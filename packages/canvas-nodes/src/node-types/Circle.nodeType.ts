import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class CircleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('circle', 'Circle', CircleComponent);
  }

  getAnchors(_def: DiagramNode) {
    return [
      { point: Point.of(0.5, 0) },
      { point: Point.of(1, 0.5) },
      { point: Point.of(0.5, 1) },
      { point: Point.of(0, 0.5) },
      { point: Point.of(0.5, 0.5), clip: true }
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const b = new PathBuilder(unitCoordinateSystem(def.bounds));
    b.moveTo(Point.of(0, -1));
    b.arcTo(Point.of(1, 0), 1, 1);
    b.arcTo(Point.of(0, 1), 1, 1);
    b.arcTo(Point.of(-1, 0), 1, 1);
    b.arcTo(Point.of(0, -1), 1, 1);
    return b;
  }
}

class CircleComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new CircleNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }
}
