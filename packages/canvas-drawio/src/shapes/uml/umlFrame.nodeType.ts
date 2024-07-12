import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class UmlFrame extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlFrame', 'UML Frame');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { x, y, h, w } = props.node.bounds;

    const cw = 70;
    const ch = 30;
    const cr = 10;

    const b = shapeBuilder.buildBoundary();

    b.path(0, 0)
      .line(cw, 0)
      .line(cw, Math.max(0, ch - cr * 1.5))
      .line(Math.max(0, cw - cr), ch)
      .line(0, ch)
      .close();
    b.fillAndStroke();

    b.path(cw, 0).line(w, 0).line(w, h).line(0, h).line(0, ch);
    b.stroke();

    shapeBuilder.text(props.cmp, '1', props.node.renderProps.text, {
      ...props.node.bounds,
      x: x,
      y: y,
      w: cw,
      h: ch
    });
  }
}
