import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class AndroidScrollbars2NodeDefinition extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.scrollbars2');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, builder: ShapeBuilder) {
    const { w, h } = props.node.bounds;

    const b = builder.buildBoundary();
    b.rect(w - 5, 0, 5, h - 7);
    b.fillAndStroke();

    b.rect(0, h - 5, w - 7, 5);
    b.fillAndStroke();
  }
}
