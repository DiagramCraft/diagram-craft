import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class DelayNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('delay', 'Delay', DelayComponent);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const xr = (0.5 * node.bounds.h) / node.bounds.w;
    const yr = 0.5;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(0, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(0, 1))
      .lineTo(_p(0, 0));
  }
}

class DelayComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(
      new DelayNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );
    shapeBuilder.text(this);
  }
}
