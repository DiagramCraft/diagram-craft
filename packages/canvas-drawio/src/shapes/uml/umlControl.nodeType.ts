import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class UmlControl extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlControl', 'UML Control');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { y, h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path((w * 3) / 8, (h / 8) * 1.1).line((w * 5) / 8, 0);
    b.stroke();

    b.ellipse(w / 2, (9 / 16) * h, w / 2, (h * 7) / 16);
    b.fillAndStroke();

    const fg = shapeBuilder.buildInterior();
    fg.path((w * 3) / 8, (h / 8) * 1.1).line((w * 5) / 8, h / 4);
    fg.stroke();

    shapeBuilder.text(props.cmp, '1', props.node.getText(), props.node.renderProps.text, {
      ...props.node.bounds,
      y: y + h / 8,
      h: h - h / 8
    });
  }
}
