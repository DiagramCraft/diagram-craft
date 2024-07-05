import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';

export class CircleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('circle', 'Circle', CircleComponent);
  }

  getAnchors(_def: DiagramNode): Anchor[] {
    return [
      { start: Point.of(0.5, 0), id: '1', type: 'point' },
      { start: Point.of(1, 0.5), id: '2', type: 'point' },
      { start: Point.of(0.5, 1), id: '3', type: 'point' },
      { start: Point.of(0, 0.5), id: '4', type: 'point' },
      { start: Point.of(0.5, 0.5), clip: true, id: 'c', type: 'center' }
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
