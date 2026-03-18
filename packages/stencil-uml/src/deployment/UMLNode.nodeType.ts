import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { Point, _p } from '@diagram-craft/geometry/point';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { resolveCssColor } from '@diagram-craft/utils/dom';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlNode?: {
        icon?: string;
      };
    }
  }
}

registerCustomNodeDefaults('umlNode', {
  icon: ''
});

const DEFAULT_DEPTH = 6;
const DEFAULT_ICON_SIZE = 18;
const DEFAULT_ICON_MARGIN = 6;

const getCubeDepth = (bounds: Box) => {
  const maxDepth = Math.max(0, Math.min(bounds.w, bounds.h) / 2 - 0.5);
  return Math.min(DEFAULT_DEPTH, maxDepth);
};

const getFrontFaceBounds = (bounds: Box) => {
  const depth = getCubeDepth(bounds);
  return {
    x: bounds.x,
    y: bounds.y + depth,
    w: bounds.w - depth,
    h: bounds.h - depth,
    r: bounds.r
  };
};

const getIconBounds = (bounds: Box) => {
  const face = getFrontFaceBounds(bounds);
  const maxMargin = Math.max(0, Math.min(DEFAULT_ICON_MARGIN, (Math.min(face.w, face.h) - 1) / 3));
  const maxSize = Math.max(1, Math.min(face.w - maxMargin * 2, face.h - maxMargin * 2));
  const size = Math.min(DEFAULT_ICON_SIZE, maxSize);
  const margin = Math.max(0, Math.min(DEFAULT_ICON_MARGIN, face.w - size, face.h - size));
  return {
    x: face.x + face.w - size - margin,
    y: face.y + margin,
    w: size,
    h: size,
    r: 0
  };
};

export class UMLNodeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlNode', 'UML Node', UMLNodeComponent);
    this.setFlags({
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const depth = getCubeDepth(def.bounds);
    const sizePct = depth / Math.min(def.bounds.w, def.bounds.h);
    const lcs = new LocalCoordinateSystem(Box.withoutRotation(def.bounds), [0, 1], [0, 1], false);

    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(0, sizePct)
      .lineTo(sizePct, 0)
      .lineTo(1, 0)
      .lineTo(1, 1 - sizePct)
      .lineTo(1 - sizePct, 1)
      .lineTo(0, 1)
      .close();
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getCustomPropertyDefinitions(def: DiagramNode) {
    return new CustomPropertyDefinition(p => [p.icon(def, 'Icon', 'custom.umlNode.icon')]);
  }
}

class UMLNodeComponent extends BaseNodeComponent<UMLNodeNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const bounds = props.node.bounds;
    const depth = getCubeDepth(bounds);
    const sizePct = depth / Math.min(bounds.w, bounds.h);
    const frontFaceBounds = getFrontFaceBounds(bounds);
    const lcs = new LocalCoordinateSystem(Box.withoutRotation(bounds), [0, 1], [0, 1], false);

    shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

    const front = new PathListBuilder().withTransform(lcs.toGlobalTransforms);
    front.moveTo(Point.of(0, sizePct));
    front.lineTo(Point.of(1 - sizePct, sizePct));
    front.lineTo(Point.of(1 - sizePct, 1));
    front.lineTo(Point.of(0, 1));
    front.close();
    shapeBuilder.path(front.getPaths().all());

    const top = new PathListBuilder().withTransform(lcs.toGlobalTransforms);
    top.moveTo(Point.of(sizePct, 0));
    top.lineTo(Point.of(1, 0));
    top.lineTo(Point.of(1 - sizePct, sizePct));
    top.lineTo(Point.of(0, sizePct));
    top.close();
    shapeBuilder.path(top.getPaths().all());

    const side = new PathListBuilder().withTransform(lcs.toGlobalTransforms);
    side.moveTo(Point.of(1 - sizePct, sizePct));
    side.lineTo(Point.of(1, 0));
    side.lineTo(Point.of(1, 1 - sizePct));
    side.lineTo(Point.of(1 - sizePct, 1));
    side.close();
    shapeBuilder.path(side.getPaths().all());

    const icon = props.nodeProps.custom.umlNode?.icon ?? '';
    if (icon !== '') {
      const diagramElement = CanvasDomHelper.diagramElement(props.node.diagram);
      const color = resolveCssColor(props.nodeProps.stroke.color, [diagramElement, document.body]);
      const iconBounds = getIconBounds(bounds);
      const processedSvg = icon.replace(/currentColor/g, color);
      const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;

      shapeBuilder.add(
        svg.image({
          href,
          x: iconBounds.x,
          y: iconBounds.y,
          width: iconBounds.w,
          height: iconBounds.h,
          preserveAspectRatio: 'xMidYMid meet',
          style: 'pointer-events: none;'
        })
      );
    }

    shapeBuilder.text(this, '1', props.node.getText(), props.nodeProps.text, frontFaceBounds);

    if (props.node.children.length > 0) {
      shapeBuilder.add(renderChildren(this, props.node, props));
    }
  }
}
