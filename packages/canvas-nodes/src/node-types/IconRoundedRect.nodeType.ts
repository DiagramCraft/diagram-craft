import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { round } from '@diagram-craft/utils/math';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

// NodeProps extension for custom props *****************************************

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      iconRoundedRect?: {
        radius?: number;
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

registerCustomNodeDefaults('iconRoundedRect', {
  radius: 5,
  icon: '',
  iconPosition: 'nw',
  iconSize: 20,
  iconColor: '',
  iconPaddingX: 5,
  iconPaddingY: 5
});

// Helper to compute icon coordinates *******************************************

function getIconCoords(
  bounds: Box,
  position: string,
  size: number,
  paddingX: number,
  paddingY: number
): { x: number; y: number } {
  const { x, y, w, h } = bounds;
  switch (position) {
    case 'nw':
      return { x: x + paddingX, y: y + paddingY };
    case 'n':
      return { x: x + w / 2 - size / 2, y: y + paddingY };
    case 'ne':
      return { x: x + w - size - paddingX, y: y + paddingY };
    case 'w':
      return { x: x + paddingX, y: y + h / 2 - size / 2 };
    case 'c':
      return { x: x + w / 2 - size / 2, y: y + h / 2 - size / 2 };
    case 'e':
      return { x: x + w - size - paddingX, y: y + h / 2 - size / 2 };
    case 'sw':
      return { x: x + paddingX, y: y + h - size - paddingY };
    case 's':
      return { x: x + w / 2 - size / 2, y: y + h - size - paddingY };
    case 'se':
      return { x: x + w - size - paddingX, y: y + h - size - paddingY };
    default:
      return { x: x + paddingX, y: y + paddingY };
  }
}

// NodeDefinition and Shape *****************************************************

export class IconRoundedRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('icon-rounded-rect', 'Icon Rounded Rectangle', IconRoundedRectComponent);
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
      p.number(def, 'Radius', 'custom.iconRoundedRect.radius', {
        maxValue: 60,
        unit: 'px',
        validate: v => v < def.bounds.h / 2 && v < def.bounds.w / 2
      }),
      p.icon(def, 'Icon', 'custom.iconRoundedRect.icon'),
      p.select(
        def,
        'Icon Position',
        'custom.iconRoundedRect.iconPosition',
        [
          { value: 'nw', label: 'Top Left' },
          { value: 'n', label: 'Top Center' },
          { value: 'ne', label: 'Top Right' },
          { value: 'w', label: 'Middle Left' },
          { value: 'c', label: 'Center' },
          { value: 'e', label: 'Middle Right' },
          { value: 'sw', label: 'Bottom Left' },
          { value: 's', label: 'Bottom Center' },
          { value: 'se', label: 'Bottom Right' }
        ]
      ),
      p.number(def, 'Icon Size', 'custom.iconRoundedRect.iconSize', {
        maxValue: 200,
        unit: 'px'
      }),
      p.color(def, 'Icon Color', 'custom.iconRoundedRect.iconColor'),
      p.number(def, 'Padding X', 'custom.iconRoundedRect.iconPaddingX', {
        maxValue: 200,
        unit: 'px'
      }),
      p.number(def, 'Padding Y', 'custom.iconRoundedRect.iconPaddingY', {
        maxValue: 200,
        unit: 'px'
      })
    ]);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const radius = node.renderProps.custom.iconRoundedRect.radius;
    const xr = radius / node.bounds.w;
    const yr = radius / node.bounds.h;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(xr, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
  }
}

class IconRoundedRectComponent extends BaseNodeComponent<IconRoundedRectNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const def = new IconRoundedRectNodeDefinition();

    shapeBuilder.boundaryPath(def.getBoundingPathBuilder(props.node).getPaths().all());
    shapeBuilder.text(this);

    const radius = props.nodeProps.custom.iconRoundedRect?.radius ?? 5;
    shapeBuilder.controlPoint(_p(props.node.bounds.x + radius, props.node.bounds.y), (p, uow) => {
      const rotatedCorner = Point.rotateAround(
        props.node.bounds,
        props.node.bounds.r,
        Box.center(props.node.bounds)
      );
      const distance = Math.max(0, p.x - rotatedCorner.x);
      if (distance < props.node.bounds.w / 2 && distance < props.node.bounds.h / 2) {
        props.node.updateCustomProps(
          'iconRoundedRect',
          props => (props.radius = distance),
          uow
        );
      }
      return `Radius: ${round(props.node.renderProps.custom.iconRoundedRect.radius)}px`;
    });

    const icon = props.nodeProps.custom.iconRoundedRect?.icon ?? '';
    if (icon) {
      const iconSize = props.nodeProps.custom.iconRoundedRect?.iconSize ?? 20;
      const iconPosition = props.nodeProps.custom.iconRoundedRect?.iconPosition ?? 'nw';
      const iconColor = props.nodeProps.custom.iconRoundedRect?.iconColor ?? '';
      const iconPaddingX = props.nodeProps.custom.iconRoundedRect?.iconPaddingX ?? 5;
      const iconPaddingY = props.nodeProps.custom.iconRoundedRect?.iconPaddingY ?? 5;

      const strokeColor = props.nodeProps.stroke.color;
      const color = iconColor || strokeColor;
      const processedSvg = icon.replace(/currentColor/g, color);

      const { x, y } = getIconCoords(props.node.bounds, iconPosition, iconSize, iconPaddingX, iconPaddingY);
      const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;

      shapeBuilder.add(
        svg.image({
          href,
          x,
          y,
          width: iconSize,
          height: iconSize,
          preserveAspectRatio: 'xMidYMid meet',
          style: 'pointer-events: none;'
        })
      );
    }
  }
}
