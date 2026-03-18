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
import { Point, _p } from '@diagram-craft/geometry/point';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { resolveCssColor } from '@diagram-craft/utils/dom';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import {
  renderStereotypeIconInBounds,
  UML_STEREOTYPE_ICON_OPTIONS,
  UmlStereotypeIcon
} from '@diagram-craft/stencil-uml/common/stereotypeIcon';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlNode?: {
        stereotypeIcon?: UmlStereotypeIcon;
        icon?: string;
      };
    }
  }
}

registerCustomNodeDefaults('umlNode', {
  stereotypeIcon: 'empty',
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
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const depth = getCubeDepth(def.bounds);
    const bounds = Box.withoutRotation(def.bounds);

    return new PathListBuilder()
      .moveTo(bounds.x, bounds.y + depth)
      .lineTo(bounds.x + depth, bounds.y)
      .lineTo(bounds.x + bounds.w, bounds.y)
      .lineTo(bounds.x + bounds.w, bounds.y + bounds.h - depth)
      .lineTo(bounds.x + bounds.w - depth, bounds.y + bounds.h)
      .lineTo(bounds.x, bounds.y + bounds.h)
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
    return new CustomPropertyDefinition(p => [
      p.select(def, 'Stereotype Icon', 'custom.umlNode.stereotypeIcon', UML_STEREOTYPE_ICON_OPTIONS),
      p.icon(def, 'Custom Icon', 'custom.umlNode.icon')
    ]);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    node.diagram.moveElement(elements, uow, node.layer, {
      relation: 'on',
      element: node
    });
  }
}

class UMLNodeComponent extends BaseNodeComponent<UMLNodeNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const bounds = props.node.bounds;
    const depth = getCubeDepth(bounds);
    const frontFaceBounds = getFrontFaceBounds(bounds);
    const unrotatedBounds = Box.withoutRotation(bounds);

    shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

    const front = new PathListBuilder();
    front.moveTo(Point.of(unrotatedBounds.x, unrotatedBounds.y + depth));
    front.lineTo(Point.of(unrotatedBounds.x + unrotatedBounds.w - depth, unrotatedBounds.y + depth));
    front.lineTo(Point.of(unrotatedBounds.x + unrotatedBounds.w - depth, unrotatedBounds.y + unrotatedBounds.h));
    front.lineTo(Point.of(unrotatedBounds.x, unrotatedBounds.y + unrotatedBounds.h));
    front.close();
    shapeBuilder.path(front.getPaths().all());

    const top = new PathListBuilder();
    top.moveTo(Point.of(unrotatedBounds.x + depth, unrotatedBounds.y));
    top.lineTo(Point.of(unrotatedBounds.x + unrotatedBounds.w, unrotatedBounds.y));
    top.lineTo(Point.of(unrotatedBounds.x + unrotatedBounds.w - depth, unrotatedBounds.y + depth));
    top.lineTo(Point.of(unrotatedBounds.x, unrotatedBounds.y + depth));
    top.close();
    shapeBuilder.path(top.getPaths().all());

    const side = new PathListBuilder();
    side.moveTo(
      Point.of(unrotatedBounds.x + unrotatedBounds.w - depth, unrotatedBounds.y + depth)
    );
    side.lineTo(Point.of(unrotatedBounds.x + unrotatedBounds.w, unrotatedBounds.y));
    side.lineTo(
      Point.of(unrotatedBounds.x + unrotatedBounds.w, unrotatedBounds.y + unrotatedBounds.h - depth)
    );
    side.lineTo(
      Point.of(unrotatedBounds.x + unrotatedBounds.w - depth, unrotatedBounds.y + unrotatedBounds.h)
    );
    side.close();
    shapeBuilder.path(side.getPaths().all());

    const stereotypeIcon = props.nodeProps.custom.umlNode?.stereotypeIcon ?? 'empty';
    if (stereotypeIcon !== 'empty') {
      const diagramElement = CanvasDomHelper.diagramElement(props.node.diagram);
      const color = resolveCssColor(props.nodeProps.stroke.color, [diagramElement, document.body]);
      const iconBounds = getIconBounds(bounds);
      const icon = renderStereotypeIconInBounds(iconBounds, stereotypeIcon, props.nodeProps, {
        customIcon: props.nodeProps.custom.umlNode?.icon ?? '',
        resolvedColor: color
      });
      if (icon) {
        shapeBuilder.add(icon);
      }
    }

    shapeBuilder.text(this, '1', props.node.getText(), props.nodeProps.text, frontFaceBounds);

    if (props.node.children.length > 0) {
      shapeBuilder.add(renderChildren(this, props.node, props));
    }
  }
}
