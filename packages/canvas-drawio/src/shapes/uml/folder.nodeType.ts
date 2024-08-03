import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class Folder extends SimpleShapeNodeDefinition {
  constructor() {
    super('folder', 'UML Folder');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;
    const b = shapeBuilder.buildBoundary();

    b.path(0, 0).line(50, 0).line(50, 15).line(w, 15).line(w, h).line(0, h).line(0, 0);
    b.fillAndStroke();

    b.path(0, 15).line(50, 15);
    b.stroke();

    shapeBuilder.text(props.cmp);
  }
}
