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

    b.rect(0, 15, w, h - 15);
    b.rect(0, 0, 50, 15);
    b.fillAndStroke();

    shapeBuilder.text(props.cmp);
  }
}
