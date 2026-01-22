import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class DiamondNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('diamond', 'Diamond', DiamondComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(0.5, 0))
      .lineTo(_p(1, 0.5))
      .lineTo(_p(0.5, 1))
      .lineTo(_p(0, 0.5))
      .lineTo(_p(0.5, 0));
  }
}

class DiamondComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DiamondNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }
}
