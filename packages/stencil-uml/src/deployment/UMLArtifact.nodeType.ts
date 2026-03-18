import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { mustExist } from '@diagram-craft/utils/assert';
import { _p } from '@diagram-craft/geometry/point';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { resolveCssColor } from '@diagram-craft/utils/dom';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlArtifact?: {
        icon?: string;
        iconPosition?: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'c';
        iconSize?: number;
        iconColor?: string;
        iconPaddingX?: number;
        iconPaddingY?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlArtifact', {
  icon: '',
  iconPosition: 'nw',
  iconSize: 24,
  iconColor: '',
  iconPaddingX: 8,
  iconPaddingY: 8
});

type UmlArtifactCustomProps = NonNullable<DiagramCraft.CustomNodePropsExtensions['umlArtifact']>;

const getIconBounds = (bounds: Box, props: UmlArtifactCustomProps): Box => {
  const position = props.iconPosition ?? 'nw';
  const size = props.iconSize ?? 24;
  const paddingX = props.iconPaddingX ?? 8;
  const paddingY = props.iconPaddingY ?? 8;
  const { x, y, w, h } = bounds;

  switch (position) {
    case 'nw':
      return { x: x + paddingX, y: y + paddingY, w: size, h: size, r: 0 };
    case 'n':
      return { x: x + w / 2 - size / 2, y: y + paddingY, w: size, h: size, r: 0 };
    case 'ne':
      return { x: x + w - size - paddingX, y: y + paddingY, w: size, h: size, r: 0 };
    case 'w':
      return { x: x + paddingX, y: y + h / 2 - size / 2, w: size, h: size, r: 0 };
    case 'c':
      return { x: x + w / 2 - size / 2, y: y + h / 2 - size / 2, w: size, h: size, r: 0 };
    case 'e':
      return { x: x + w - size - paddingX, y: y + h / 2 - size / 2, w: size, h: size, r: 0 };
    case 'sw':
      return { x: x + paddingX, y: y + h - size - paddingY, w: size, h: size, r: 0 };
    case 's':
      return { x: x + w / 2 - size / 2, y: y + h - size - paddingY, w: size, h: size, r: 0 };
    case 'se':
      return { x: x + w - size - paddingX, y: y + h - size - paddingY, w: size, h: size, r: 0 };
    default:
      return { x: x + paddingX, y: y + paddingY, w: size, h: size, r: 0 };
  }
};

const templatePaths = PathListBuilder.fromString(
  `
      M 0 0
      L 7 0
      L 10 2.5
      L 10 10
      L 0 10
      Z
    `
).getPaths();

const foldPaths = PathListBuilder.fromString(
  `
      M 7 0
      L 7 2.5
      L 10 2.5
    `
).getPaths();

const pathBounds = templatePaths.bounds();
const path = mustExist(templatePaths.all()[0]);

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
    const t = TransformFactory.fromTo(pathBounds, Box.withoutRotation(def.bounds));
    return PathListBuilder.fromPath(path).withTransform(t);
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
      p.icon(def, 'Icon', 'custom.umlArtifact.icon'),
      p.select(def, 'Icon Position', 'custom.umlArtifact.iconPosition', [
        { value: 'nw', label: 'Top Left' },
        { value: 'n', label: 'Top Center' },
        { value: 'ne', label: 'Top Right' },
        { value: 'w', label: 'Middle Left' },
        { value: 'c', label: 'Center' },
        { value: 'e', label: 'Middle Right' },
        { value: 'sw', label: 'Bottom Left' },
        { value: 's', label: 'Bottom Center' },
        { value: 'se', label: 'Bottom Right' }
      ]),
      p.number(def, 'Icon Size', 'custom.umlArtifact.iconSize', {
        maxValue: 200,
        unit: 'px'
      }),
      p.color(def, 'Icon Color', 'custom.umlArtifact.iconColor'),
      p.number(def, 'Padding X', 'custom.umlArtifact.iconPaddingX', {
        maxValue: 200,
        unit: 'px'
      }),
      p.number(def, 'Padding Y', 'custom.umlArtifact.iconPaddingY', {
        maxValue: 200,
        unit: 'px'
      })
    ]);
  }
}

class UMLArtifactComponent extends BaseNodeComponent<UMLArtifactNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const def = new UMLArtifactNodeDefinition();
    const bounds = props.node.bounds;

    shapeBuilder.boundaryPath(def.getBoundingPathBuilder(props.node).getPaths().all());
    shapeBuilder.path(
      PathListBuilder.fromPath(mustExist(foldPaths.all()[0]))
        .getPaths(TransformFactory.fromTo(pathBounds, Box.withoutRotation(bounds)))
        .all(),
      undefined,
      {
        style: { fill: 'none' }
      }
    );

    const customProps = props.nodeProps.custom.umlArtifact ?? {};
    const icon = customProps.icon ?? '';
    if (icon !== '') {
      const iconColor = customProps.iconColor ?? '';
      const diagramElement = CanvasDomHelper.diagramElement(props.node.diagram);

      const color = resolveCssColor(iconColor !== '' ? iconColor : props.nodeProps.stroke.color, [
        diagramElement,
        document.body
      ]);
      const iconBounds = getIconBounds(getPageContentBounds(bounds), customProps);
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

    shapeBuilder.text(this);
  }
}
