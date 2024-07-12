import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class RequiredInterface extends SimpleShapeNodeDefinition {
  constructor() {
    super('requiredInterface', 'Required Interface');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(0, 0)
      .quad(w, 0, w, h / 2)
      .quad(w, h, 0, h);
    b.stroke();
  }
}
