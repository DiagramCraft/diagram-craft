import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class DocumentNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('document', 'Document', DocumentNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = new DocumentNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

      shapeBuilder.boundaryPath(boundary.all());
      shapeBuilder.text(this);
    }
  };

  getBoundingPathBuilder(node: DiagramNode) {
    const size = 0.3;
    const k = 1.5;

    return new PathBuilder(unitCoordinateSystem(node.bounds))
      .moveTo(_p(0, 0))
      .lineTo(_p(1, 0))
      .lineTo(_p(1, 1 - size / 2))
      .quadTo(_p(0.5, 1 - size / 2), _p(3 / 4, 1 - size * k))
      .quadTo(_p(0, 1 - size / 2), _p(1 / 4, 1 - size * (1 - k)))
      .lineTo(_p(0, size / 2))
      .close();
  }
}
