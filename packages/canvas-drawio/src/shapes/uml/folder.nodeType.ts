import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  PathListBuilder,
  translateCoordinateSystem
} from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';

const TAB_WIDTH = 50;
const TAB_HEIGHT = 15;

export class Folder extends SimpleShapeNodeDefinition {
  constructor() {
    super('folder', 'UML Folder');
  }

  /*

    |--  TAB_WIDTH  --|

    0-----------------1                               --
    |                 |                               |  TAB_HEIGHT
    |                 2---------------------------3   --
    |                                             |
    |                                             |
    |                                             |
    |                                             |
    |                                             |
    5---------------------------------------------4

   */
  getBoundingPathBuilder(node: DiagramNode) {
    const pb = new PathListBuilder().setTransform(translateCoordinateSystem(node.bounds));
    pb.moveTo(_p(0, 0))
      .lineTo(_p(TAB_WIDTH, 0))
      .lineTo(_p(TAB_WIDTH, TAB_HEIGHT))
      .lineTo(_p(node.bounds.w, TAB_HEIGHT))
      .lineTo(_p(node.bounds.w, node.bounds.h))
      .lineTo(_p(0, node.bounds.h))
      .lineTo(_p(0, 0));
    return pb;
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const b = shapeBuilder.buildBoundary();

    b.addShape(this.getBoundingPathBuilder(props.node));
    b.fillAndStroke();

    b.path(0, TAB_HEIGHT).line(TAB_WIDTH, TAB_HEIGHT);
    b.stroke();

    shapeBuilder.text(props.cmp);
  }
}
