import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { _p } from '@diagram-craft/geometry/point';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { resolveCssColor } from '@diagram-craft/utils/dom';
import {
  renderStereotypeIconInBounds,
  UML_STEREOTYPE_ICON_OPTIONS,
  UmlStereotypeIcon
} from '@diagram-craft/stencil-uml/common/stereotypeIcon';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlArtifact?: {
        stereotypeIcon?: UmlStereotypeIcon;
        icon?: string;
      };
    }
  }
}

registerCustomNodeDefaults('umlArtifact', {
  stereotypeIcon: 'artifact',
  icon: ''
});

const getIconBounds = (bounds: Box): Box => {
  const paddingX = bounds.w * 0.1;
  const paddingY = bounds.h * 0.2;
  const size = Math.max(1, Math.min(bounds.w - paddingX * 2, bounds.h - paddingY * 2));
  return {
    x: bounds.x + bounds.w / 2 - size / 2,
    y: bounds.y + bounds.h / 2 - size / 2,
    w: size,
    h: size,
    r: 0
  };
};

const getFoldSize = (bounds: Box) => Math.max(1, Math.min(bounds.w, bounds.h) * 0.25);

const buildArtifactPathBuilder = (bounds: Box) => {
  const foldSize = getFoldSize(bounds);
  return new PathListBuilder()
    .moveTo(_p(bounds.x, bounds.y))
    .lineTo(_p(bounds.x + bounds.w - foldSize, bounds.y))
    .lineTo(_p(bounds.x + bounds.w, bounds.y + foldSize))
    .lineTo(_p(bounds.x + bounds.w, bounds.y + bounds.h))
    .lineTo(_p(bounds.x, bounds.y + bounds.h))
    .close();
};

const buildFoldPathBuilder = (bounds: Box) => {
  const foldSize = getFoldSize(bounds);
  return new PathListBuilder()
    .moveTo(_p(bounds.x + bounds.w - foldSize, bounds.y))
    .lineTo(_p(bounds.x + bounds.w - foldSize, bounds.y + foldSize))
    .lineTo(_p(bounds.x + bounds.w, bounds.y + foldSize));
};

const getPageContentBounds = (bounds: Box) =>
  Box.fromCorners(
    _p(bounds.x + 6, bounds.y + 6),
    _p(bounds.x + Math.max(bounds.w - 16, 6), bounds.y + Math.max(bounds.h - 10, 6))
  );

export class UMLArtifactNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlArtifact', 'UML Artifact', UMLArtifactComponent);
    this.setFlags({
      [NodeFlags.StyleRounding]: false
    });
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return buildArtifactPathBuilder(Box.withoutRotation(def.bounds));
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
      p.select(
        def,
        'Stereotype Icon',
        'custom.umlArtifact.stereotypeIcon',
        UML_STEREOTYPE_ICON_OPTIONS
      ),
      p.icon(def, 'Custom Icon', 'custom.umlArtifact.icon')
    ]);
  }
}

class UMLArtifactComponent extends BaseNodeComponent<UMLArtifactNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const def = new UMLArtifactNodeDefinition();
    const bounds = props.node.bounds;

    shapeBuilder.boundaryPath(def.getBoundingPathBuilder(props.node).getPaths().all());
    shapeBuilder.path(
      buildFoldPathBuilder(Box.withoutRotation(bounds)).getPaths().all(),
      undefined,
      {
        style: { fill: 'none' }
      }
    );

    const customProps = props.nodeProps.custom.umlArtifact ?? {};
    const stereotypeIcon = customProps.stereotypeIcon ?? 'artifact';
    if (stereotypeIcon !== 'empty') {
      const diagramElement = CanvasDomHelper.diagramElement(props.node.diagram);
      const color = resolveCssColor(props.nodeProps.stroke.color, [diagramElement, document.body]);
      const iconBounds = getIconBounds(getPageContentBounds(bounds));
      const icon = renderStereotypeIconInBounds(iconBounds, stereotypeIcon, props.nodeProps, {
        customIcon: customProps.icon ?? '',
        resolvedColor: color
      });
      if (icon) {
        shapeBuilder.add(icon);
      }
    }

    shapeBuilder.text(this);
  }
}
