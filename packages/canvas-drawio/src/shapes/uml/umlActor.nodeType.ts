import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class UmlActor extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlActor', 'UML Actor');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.ellipse(w / 2, h / 8, w / 4, h / 8);
    b.fillAndStroke();

    b.path(w / 2, h / 4).line(w / 2, (2 * h) / 3);
    b.path(w / 2, h / 3).line(0, h / 3);
    b.path(w / 2, h / 3).line(w, h / 3);
    b.path(w / 2, (2 * h) / 3).line(0, h);
    b.path(w / 2, (2 * h) / 3).line(w, h);
    b.fillAndStroke();

    shapeBuilder.text(props.cmp, '1', props.node.getText(), props.node.renderProps.text, {
      ...props.node.bounds,
      y: props.node.bounds.y + h
    });
  }
}
