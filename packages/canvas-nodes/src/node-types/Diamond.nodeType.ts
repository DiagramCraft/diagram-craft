import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class DiamondNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('diamond', 'Diamond', DiamondComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathListBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(0.5, 0));
    pathBuilder.lineTo(Point.of(1, 0.5));
    pathBuilder.lineTo(Point.of(0.5, 1));
    pathBuilder.lineTo(Point.of(0, 0.5));
    pathBuilder.lineTo(Point.of(0.5, 0));

    return pathBuilder;
  }
}

class DiamondComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DiamondNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }
}
