import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent } from '../components/BaseNodeComponent';
import { PathListBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class LineNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'line', displayName = 'Line') {
    super(name, displayName, LineComponent);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return new PathListBuilder()
      .setTransform(unitCoordinateSystem(node.bounds))
      .moveTo(_p(0, 0.5))
      .lineTo(_p(1, 0.5));
  }
}

class LineComponent extends BaseNodeComponent {}
