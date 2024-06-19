import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

export class DrawioImageNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'drawioImage', displayName = 'DrawIO Image') {
    super(name, displayName, DrawioImageComponent);
  }
}

class DrawioImageComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DrawioImageNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    if (props.nodeProps.shapeDrawio.imageWidth > 0) {
      shapeBuilder.boundaryPath(boundary.all(), {
        ...props.nodeProps,
        fill: { enabled: false, color: 'transparent', type: 'solid' }
      });

      shapeBuilder.add(
        svg.image({
          x: props.node.bounds.x + 4,
          y: props.node.bounds.y + 4,
          width: props.nodeProps.shapeDrawio.imageWidth,
          height: props.nodeProps.shapeDrawio.imageHeight,
          href: props.nodeProps.fill.image.url
        })
      );
    } else {
      // TODO: Is this branch ever taken?
      shapeBuilder.boundaryPath(boundary.all());
    }

    const w = props.nodeProps.shapeDrawio.imageWidth === 0 ? props.node.bounds.w : 0;

    const bounds = props.node.bounds;

    const textPosition = props.nodeProps.shapeDrawio.textPosition;

    let textBounds = bounds;
    if (textPosition === 'right') {
      textBounds = {
        x: bounds.x + w,
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
