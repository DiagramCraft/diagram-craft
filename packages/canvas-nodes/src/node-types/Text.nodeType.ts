import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class TextNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('text', 'Text', TextComponent);
  }
}

class TextComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(
      new TextNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );
    shapeBuilder.text(
      this,
      '1',
      props.node.getText(),
      props.nodeProps.text,
      props.node.bounds,
      this.onTextSizeChange(props)
    );
  }
}
