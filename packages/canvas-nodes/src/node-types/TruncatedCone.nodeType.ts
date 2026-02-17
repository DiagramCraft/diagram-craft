import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { round } from '@diagram-craft/utils/math';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
  topRatio?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      truncatedCone?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('truncatedCone', { size: 20, topRatio: 0.5 });

// Custom properties ************************************************************

const propSize = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Depth', 'custom.truncatedCone.size', {
    maxValue: Number.MAX_VALUE,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < node.bounds.h / 2
  });

const propTopRatio = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Top Ratio', 'custom.truncatedCone.topRatio', {
    maxValue: 3,
    unit: '',
    format: v => round(v, 2),
    validate: v => v > 0 && v <= 3
  });

// Helper functions *************************************************************

const getGeometry = (def: DiagramNode) => {
  const bounds = def.bounds;
  const { size, topRatio } = def.renderProps.custom.truncatedCone;

  const maxWidth = Math.max(1, topRatio);
  const sizeNorm = size / bounds.h / maxWidth;
  const topSizeNorm = sizeNorm * topRatio;

  return {
    maxWidth,
    sizeNorm,
    topSizeNorm,
    baseHalfWidth: 0.5 / maxWidth,
    topHalfWidth: topRatio / 2 / maxWidth
  };
};

const getTextBounds = (def: DiagramNode) => {
  const bounds = def.bounds;
  const { sizeNorm, topSizeNorm, maxWidth } = getGeometry(def);

  // Text starts below entire top ellipse (front + back visible)
  // Text ends at back edge of base ellipse (only front visible)
  const textTop = topSizeNorm * bounds.h;
  const textBottom = (sizeNorm / 2) * bounds.h;

  // Width constrained to the narrower of top/base, centered horizontally
  const textWidth = bounds.w / maxWidth;
  const textX = bounds.x + (bounds.w - textWidth) / 2;

  return {
    x: textX,
    y: bounds.y + textTop,
    w: textWidth,
    h: bounds.h - textTop - textBottom,
    r: bounds.r
  };
};

// NodeDefinition and Shape *****************************************************

export class TruncatedConeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('truncatedCone', 'Truncated Cone', TruncatedConeNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<TruncatedConeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
      shapeBuilder.boundaryPath(boundary.all());

      const interior = this.def.getInteriorPathBuilder(props.node);
      shapeBuilder.buildInterior().addShape(interior).stroke();

      const bounds = props.node.bounds;
      const { sizeNorm, topSizeNorm, baseHalfWidth, topHalfWidth, maxWidth } = getGeometry(
        props.node
      );

      const topSize = topSizeNorm * bounds.h;
      const baseSize = sizeNorm * bounds.h;
      const centerX = bounds.x + bounds.w / 2;

      shapeBuilder.text(this, '1', props.node.getText(), props.nodeProps.text, getTextBounds(props.node));

      // Control point for depth (size) - on the base ellipse
      shapeBuilder.controlPoint(
        _p(centerX - baseHalfWidth * bounds.w, bounds.y + bounds.h - baseSize / 2),
        ({ y }, uow) => {
          const newBaseSize = (bounds.y + bounds.h - y) * 2;
          propSize(props.node).set(Math.max(1, newBaseSize * maxWidth), uow);
          return `Depth: ${props.node.renderProps.custom.truncatedCone.size}px`;
        }
      );

      // Control point for top ratio
      shapeBuilder.controlPoint(
        _p(centerX + topHalfWidth * bounds.w, bounds.y + topSize / 2),
        ({ x }, uow) => {
          const newTopHalfWidth = x - centerX;
          const newRatio = Math.max(0.1, Math.min(3, (newTopHalfWidth * 2 * maxWidth) / bounds.w));
          propTopRatio(props.node).set(newRatio, uow);
          return `Top Ratio: ${round(props.node.renderProps.custom.truncatedCone.topRatio, 2)}`;
        }
      );
    }
  };

  getShapeAnchors(def: DiagramNode): Anchor[] {
    const { sizeNorm, topSizeNorm, baseHalfWidth, topHalfWidth } = getGeometry(def);

    // Calculate x position at y=0.5 by interpolating along the sloped edge
    const topY = topSizeNorm / 2;
    const baseY = 1 - sizeNorm / 2;
    const t = (0.5 - topY) / (baseY - topY);
    const halfWidthAtMiddle = topHalfWidth + t * (baseHalfWidth - topHalfWidth);

    return [
      { id: '1', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '2', start: _p(0.5 + halfWidthAtMiddle, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '3', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '4', start: _p(0.5 - halfWidthAtMiddle, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getInteriorPathBuilder(def: DiagramNode) {
    const lcs = new LocalCoordinateSystem(def.bounds, [0, 1], [0, 1], false);
    const { topSizeNorm, topHalfWidth } = getGeometry(def);

    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(_p(0.5 - topHalfWidth, topSizeNorm / 2))
      .arcTo(_p(0.5, topSizeNorm), topHalfWidth, topSizeNorm / 2, 0, 0, 0)
      .arcTo(_p(0.5 + topHalfWidth, topSizeNorm / 2), topHalfWidth, topSizeNorm / 2, 0, 0, 0);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const lcs = new LocalCoordinateSystem(def.bounds, [0, 1], [0, 1], false);
    const { sizeNorm, topSizeNorm, baseHalfWidth, topHalfWidth } = getGeometry(def);

    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(_p(0.5 - topHalfWidth, topSizeNorm / 2))
      .arcTo(_p(0.5, 0), topHalfWidth, topSizeNorm / 2, 0, 0, 1)
      .arcTo(_p(0.5 + topHalfWidth, topSizeNorm / 2), topHalfWidth, topSizeNorm / 2, 0, 0, 1)
      .lineTo(_p(0.5 + baseHalfWidth, 1 - sizeNorm / 2))
      .arcTo(_p(0.5, 1), baseHalfWidth, sizeNorm / 2, 0, 0, 1)
      .arcTo(_p(0.5 - baseHalfWidth, 1 - sizeNorm / 2), baseHalfWidth, sizeNorm / 2, 0, 0, 1)
      .lineTo(_p(0.5 - topHalfWidth, topSizeNorm / 2));
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propSize(node), propTopRatio(node)]);
  }
}
