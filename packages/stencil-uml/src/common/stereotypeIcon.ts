import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { Box } from '@diagram-craft/geometry/box';

export type UmlStereotypeIcon = 'empty' | 'component' | 'artifact' | 'entity' | 'custom';

const STEREOTYPE_ICON_SIZE = 14;
const STEREOTYPE_ICON_PADDING = 6;

export const UML_STEREOTYPE_ICON_OPTIONS: Array<{ value: UmlStereotypeIcon; label: string }> = [
  { value: 'empty', label: 'Empty' },
  { value: 'component', label: 'Component' },
  { value: 'artifact', label: 'Artifact' },
  { value: 'entity', label: 'Entity' },
  { value: 'custom', label: 'Custom' }
];

export const getStereotypeIconTextProps = (
  textProps: NodeProps['text'] | undefined,
  _stereotypeIcon: UmlStereotypeIcon
): NodeProps['text'] | undefined => textProps;

const getBuiltInStereotypeIconChildren = (
  stereotypeIcon: UmlStereotypeIcon,
  color: string,
  fillColor: string,
  strokeWidth: number
) => {
  switch (stereotypeIcon) {
    case 'component':
      return [
        svg.path({
          'd': 'M 3.231,0 L 14,0 L 14,14 L 3.231,14 Z',
          'fill': 'none',
          'stroke': color,
          'stroke-width': strokeWidth
        }),
        svg.path({
          'd': 'M 0,2.667 L 6.462,2.667 L 6.462,6 L 0,6 Z',
          'fill': fillColor,
          'stroke': color,
          'stroke-width': strokeWidth
        }),
        svg.path({
          'd': 'M 0,8 L 6.462,8 L 6.462,11.333 L 0,11.333 Z',
          'fill': fillColor,
          'stroke': color,
          'stroke-width': strokeWidth
        })
      ];

    case 'artifact':
      return [
        svg.path({
          'd': 'M 2.333,0 L 9.667,0 L 12.667,3 L 12.667,14 L 2.333,14 Z M 9.667,0 L 9.667,3 L 12.667,3',
          'fill': fillColor,
          'stroke': color,
          'stroke-width': strokeWidth,
          'stroke-linejoin': 'round'
        })
      ];

    case 'entity':
      return [
        svg.circle({
          'cx': 7,
          'cy': 5.5,
          'r': 4.5,
          'fill': 'none',
          'stroke': color,
          'stroke-width': strokeWidth
        }),
        svg.line({
          'x1': 2.5,
          'y1': 10,
          'x2': 11.5,
          'y2': 10,
          'stroke': color,
          'stroke-width': strokeWidth,
          'stroke-linecap': 'round'
        })
      ];

    default:
      return undefined;
  }
};

export const renderStereotypeIconInBounds = (
  iconBounds: Box,
  stereotypeIcon: UmlStereotypeIcon,
  nodeProps: Pick<NodeProps, 'stroke' | 'fill'>,
  options?: {
    customIcon?: string;
    resolvedColor?: string;
  }
): VNode | undefined => {
  const shapeStrokeWidth = nodeProps.stroke?.width ?? 1;
  const color = nodeProps.stroke?.color ?? 'currentColor';
  const fillColor =
    nodeProps.fill?.enabled === false
      ? 'var(--canvas-bg)'
      : (nodeProps.fill?.color ?? 'var(--canvas-bg2)');

  if (stereotypeIcon === 'custom') {
    const customIcon = options?.customIcon ?? '';
    if (customIcon === '') {
      return undefined;
    }

    const processedSvg = customIcon.replace(/currentColor/g, options?.resolvedColor ?? color);
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;
    return svg.image({
      href,
      x: iconBounds.x,
      y: iconBounds.y,
      width: iconBounds.w,
      height: iconBounds.h,
      preserveAspectRatio: 'xMidYMid meet',
      style: 'pointer-events: none;',
      class: 'uScale'
    });
  }

  const size = Math.min(iconBounds.w, iconBounds.h);
  const x = iconBounds.x + (iconBounds.w - size) / 2;
  const y = iconBounds.y + (iconBounds.h - size) / 2;
  const scale = size / STEREOTYPE_ICON_SIZE;
  const effectiveStrokeWidth = Math.min(shapeStrokeWidth, Math.max(1, shapeStrokeWidth * 0.9));
  const strokeWidth = effectiveStrokeWidth / scale;
  const children = getBuiltInStereotypeIconChildren(stereotypeIcon, color, fillColor, strokeWidth);
  if (children === undefined) return undefined;

  return svg.g(
    {
      transform: `translate(${x} ${y}) scale(${scale})`,
      style: 'pointer-events: none;',
      class: 'uScale'
    },
    ...children
  );
};

export const renderStereotypeIcon = (
  bounds: Box,
  stereotypeIcon: UmlStereotypeIcon,
  nodeProps: Pick<NodeProps, 'stroke' | 'fill'>,
  verticalOffset = 0,
  options?: {
    customIcon?: string;
    resolvedColor?: string;
  }
): VNode | undefined => {
  const iconBounds = {
    x: bounds.x + bounds.w - STEREOTYPE_ICON_SIZE - STEREOTYPE_ICON_PADDING,
    y: bounds.y + STEREOTYPE_ICON_PADDING + verticalOffset,
    w: STEREOTYPE_ICON_SIZE,
    h: STEREOTYPE_ICON_SIZE,
    r: 0
  };

  return renderStereotypeIconInBounds(iconBounds, stereotypeIcon, nodeProps, options);
};
