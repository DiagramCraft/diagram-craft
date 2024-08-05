import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent } from '../components/BaseNodeComponent';
import { PathBuilder, simpleCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export class LineNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'line', displayName = 'Line') {
    super(name, displayName, LineComponent);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return new PathBuilder(simpleCoordinateSystem(node.bounds))
      .moveTo(_p(0, 0.5))
      .lineTo(_p(1, 0.5));
  }
}

class LineComponent extends BaseNodeComponent {}
