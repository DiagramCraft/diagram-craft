import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';

declare global {
  interface CustomNodeProps {
    drawioImage?: {
      imageWidth?: string;
      imageHeight?: string;
      imageAlign?: 'left' | 'center' | 'right';
      imageValign?: 'top' | 'middle' | 'bottom';
      imageMargin?: number;
      backgroundColor?: string;
      stylename?: string;
      keepAspect?: boolean;
      flipV?: boolean;
      flipH?: boolean;
      showLabel?: boolean;
    };
  }
}

registerCustomNodeDefaults('drawioImage', {
  imageHeight: '0',
  imageWidth: '0',
  imageAlign: 'left',
  imageValign: 'middle',
  imageMargin: 8,
  backgroundColor: 'none',
  stylename: '',
  keepAspect: true,
  flipV: false,
  flipH: false,
  showLabel: true
});

export class DrawioImageNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'drawioImage', displayName = 'DrawIO Image') {
    super(name, displayName, DrawioImageComponent);
  }
}

class DrawioImageComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new DrawioImageNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    const customProps = props.nodeProps.custom.drawioImage;

    const imageWidth = customProps.imageWidth.includes('%')
      ? props.node.bounds.w * (parseInt(customProps.imageWidth) / 100)
      : parseInt(customProps.imageWidth);
    const imageHeight = customProps.imageHeight.includes('%')
      ? props.node.bounds.h * (parseInt(customProps.imageHeight) / 100)
      : parseInt(customProps.imageHeight);

    let x = props.node.bounds.x + customProps.imageMargin;
    let y = props.node.bounds.y + customProps.imageMargin;

    if (customProps.imageAlign === 'center') {
      x = props.node.bounds.x + (props.node.bounds.w - imageWidth) / 2;
    } else if (customProps.imageAlign === 'right') {
      x = props.node.bounds.x + props.node.bounds.w - imageWidth - customProps.imageMargin;
    }

    if (customProps.imageValign === 'middle') {
      y = props.node.bounds.y + (props.node.bounds.h - imageHeight) / 2;
    } else if (customProps.imageValign === 'bottom') {
      y = props.node.bounds.y + props.node.bounds.h - imageHeight - customProps.imageMargin;
    }

    let url = props.nodeProps.fill.image.url;
    if (props.nodeProps.fill.image.id) {
      const att = props.node.diagram.document.attachments.getAttachment(
        props.nodeProps.fill.image.id
      );
      url = att?.url ?? '';
    }

    if (
      customProps.backgroundColor &&
      customProps.backgroundColor !== 'none' &&
      customProps.backgroundColor !== 'transparent'
    ) {
      shapeBuilder.add(
        svg.rect({
          x: props.node.bounds.x,
          y: props.node.bounds.y,
          width: props.node.bounds.w,
          height: props.node.bounds.h,
          fill: customProps.backgroundColor
        })
      );
    }

    if (url && url !== '') {
      shapeBuilder.add(
        svg.image({
          x: x,
          y: y,
          width: imageWidth,
          height: imageHeight,
          href: url, //props.nodeProps.fill.image.url,
          preserveAspectRatio: customProps.keepAspect ? 'xMidYMin meet' : 'none meet',
          transform: `${customProps.flipH ? Transforms.flipH(props.node.bounds) : ''} ${customProps.flipV ? Transforms.flipV(props.node.bounds) : ''}`
        })
      );
    }

    shapeBuilder.boundaryPath(boundary.all(), {
      ...props.nodeProps,
      fill: {
        enabled: false,
        color: 'transparent',
        type: 'solid'
      }
    });

    if (customProps.showLabel) {
      const w = imageWidth; // imageWidth === 0 ? props.node.bounds.w : 0;

      const bounds = props.node.bounds;

      const textPosition = props.nodeProps.text.position;

      let textBounds = bounds;
      if (textPosition === 'e') {
        textBounds = {
          x: bounds.x + w,
          y: bounds.y,
          w: 200,
          h: bounds.h,
          r: bounds.r
        };
      } else if (textPosition === 's') {
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

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        {
          ...props.nodeProps.text,
          position: 'c'
        },
        textBounds,
        undefined
      );
    }
  }
}
