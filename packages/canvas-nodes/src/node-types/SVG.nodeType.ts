import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

// NodeProps extension for custom props *****************************************

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#4488ff"/></svg>`;

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
    })
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(0, 0))
      .lineTo(_p(1, 0))
      .lineTo(_p(1, 1))
      .lineTo(_p(0, 1))
      .close();
  }

  getCustomPropertyDefinitions(_node: DiagramNode) {
    return new CustomPropertyDefinition();
  }
}

class SVGComponent extends BaseNodeComponent<SVGNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const svgContent = props.nodeProps.custom.svg?.svgContent ?? DEFAULT_SVG;
    const { x, y, w: width, h: height } = props.node.bounds;

    shapeBuilder.noBoundaryNeeded();

    // Transparent rect for mouse interaction (hit target)
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
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;
    shapeBuilder.add(
      svg.image({
        href: dataUri,
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
