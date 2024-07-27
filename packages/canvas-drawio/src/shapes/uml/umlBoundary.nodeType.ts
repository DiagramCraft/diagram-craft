import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class UmlBoundary extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlBoundary', 'UML Boundary');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { x, h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(0, h / 4).line(0, (h * 3) / 4);
    b.path(0, h / 2).line(w / 6, h / 2);
    b.stroke();

    b.ellipse((7 * w) / 12, h / 2, (w * 5) / 12, h / 2);
    b.fillAndStroke();

    shapeBuilder.text(props.cmp, '1', props.node.getText(), props.node.renderProps.text, {
      ...props.node.bounds,
      x: x + w / 6,
      w: w - w / 6
    });
  }
}
