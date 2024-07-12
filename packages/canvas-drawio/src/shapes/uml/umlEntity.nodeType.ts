import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class UmlEntity extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlEntity', 'UML Entity');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(w / 8, h).line((w * 7) / 8, h);
    b.ellipse(w / 2, h / 2, w / 2, h / 2);
    b.stroke();

    shapeBuilder.text(props.cmp);
  }
}
