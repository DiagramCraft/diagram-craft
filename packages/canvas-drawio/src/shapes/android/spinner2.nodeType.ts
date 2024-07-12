import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class Spinner2NodeDefinition extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.spinner2');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder) {
    const { w, h } = props.node.bounds;
    const k = Math.min(w / 10, h);

    const b = shapeBuilder.buildBoundary();
    b.path(0, h).line(w, h);
    b.stroke();

    b.path(w - k, h)
      .line(w, h - k)
      .line(w, h)
      .close();
    b.fillAndStroke();

    shapeBuilder.text(props.cmp);
  }
}
