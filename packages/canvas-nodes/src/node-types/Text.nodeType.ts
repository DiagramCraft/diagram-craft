import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { Extent } from '@diagram-craft/geometry/extent';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

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
      (size: Extent) => {
        const width = size.w;
        const height = size.h;

        // Grow only
        // TODO: Maybe we want to control this somehow
        if (width > props.node.bounds.w || height > props.node.bounds.h) {
          UnitOfWork.execute(props.node.diagram!, uow => {
            props.node.setBounds(
              {
                ...props.node.bounds,
                h: height > props.node.bounds.h ? height : props.node.bounds.h,
                w: width > props.node.bounds.w ? width : props.node.bounds.w
              },
              uow
            );
          });
        }
      }
    );
  }
}
