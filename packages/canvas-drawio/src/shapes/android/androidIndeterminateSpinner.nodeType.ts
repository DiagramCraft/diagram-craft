import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class AndroidIndeterminateSpinner extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.indeterminateSpinner');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, b: ShapeBuilder) {
    const { w, h } = props.node.bounds;

    const g = b.buildBoundary(w, h);

    g.path(0.5, 0.1)
      .arc(0.4, 0.4, 0, 0, 0, 0.5, 0.9)
      .line(0.5, 1)
      .arc(0.5, 0.5, 0, 0, 1, 0.5, 0)
      .close();
    g.linearGradient('#aaaaaa', '#dddddd', Math.PI / 2);
    g.fill();

    g.path(0.5, 0.1)
      .arc(0.4, 0.4, 0, 0, 1, 0.5, 0.9)
      .line(0.5, 1)
      .arc(0.5, 0.5, 0, 0, 0, 0.5, 0)
      .close();
    g.linearGradient('#dddddd', '#ffffff', -Math.PI / 2);
    g.fill();
  }
}
