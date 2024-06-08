import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class DrawioImageNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'drawioImage', displayName = 'DrawIO Image') {
    super(name, displayName, DrawioImageComponent);
  }
}

class DrawioImageComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DrawioImageNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());

    const bounds = props.node.bounds;

    const textPosition = props.nodeProps.shapeDrawio.textPosition;

    let textBounds = bounds;
    if (textPosition === 'right') {
      textBounds = {
        x: bounds.x + bounds.w,
        y: bounds.y,
        w: 200,
        h: bounds.h,
        r: bounds.r
      };
    } else if (textPosition === 'bottom' || textPosition === '') {
      textBounds = {
        x: bounds.x - 50,
        y: bounds.y + bounds.h,
        w: bounds.w + 100,
        h: 100,
        r: bounds.r
      };
    } else {
      console.warn('Unknown text position: ', textPosition);
    }

    shapeBuilder.text(this, '1', props.nodeProps.text, textBounds, undefined);
  }
}
