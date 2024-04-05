import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';

export class DiamondNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('diamond', 'Diamond');
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

export class DiamondComponent extends BaseShape {
  build(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DiamondNodeDefinition().getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this);
  }
}
