import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

// NodeProps extension for custom props *****************************************

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="black"/></svg>`;

type ExtraProps = {
  svgContent?: string;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      svg?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('svg', {
  svgContent: DEFAULT_SVG
});

// NodeDefinition and Shape *****************************************************

export class SVGNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('svg', 'SVG', SVGComponent);
    this.setFlags({
      [NodeFlags.StyleFill]: false
    });
  }
}

class SVGComponent extends BaseNodeComponent<SVGNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const svgContent = props.nodeProps.custom.svg?.svgContent ?? DEFAULT_SVG;
    const { x, y, w: width, h: height } = props.node.bounds;

    shapeBuilder.noBoundaryNeeded();

    // Create hit target
    shapeBuilder.add(
      svg.rect({
        x,
        y,
        width,
        height,
        fill: 'transparent',
        on: {
          mousedown: props.onMouseDown,
          dblclick: shapeBuilder.makeOnDblclickHandle()
        }
      })
    );

    // Replace currentColor with the node's stroke color before encoding
    const strokeColor = props.nodeProps.stroke.color;
    const processedSvg = svgContent.replace(/currentColor/g, strokeColor);

    // Render SVG content as image filling the node bounds
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;
    shapeBuilder.add(
      svg.image({
        href,
        x,
        y,
        width,
        height,
        preserveAspectRatio: 'none',
        style: 'pointer-events: none;'
      })
    );

    shapeBuilder.text(this);
  }
}
