import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class AndroidAnchorNodeDefinition extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.anchor');
  }

  buildShape({ cmp }: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.text(cmp);
  }
}
