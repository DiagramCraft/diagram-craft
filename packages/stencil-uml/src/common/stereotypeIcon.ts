import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { Box } from '@diagram-craft/geometry/box';

export type UmlStereotypeIcon = 'empty' | 'component' | 'artifact';

const STEREOTYPE_ICON_SIZE = 14;
const STEREOTYPE_ICON_PADDING = 6;

export const UML_STEREOTYPE_ICON_OPTIONS: Array<{ value: UmlStereotypeIcon; label: string }> = [
  { value: 'empty', label: 'Empty' },
  { value: 'component', label: 'Component' },
  { value: 'artifact', label: 'Artifact' }
];

export const getStereotypeIconTextProps = (
  textProps: NodeProps['text'] | undefined,
  _stereotypeIcon: UmlStereotypeIcon
): NodeProps['text'] | undefined => textProps;

export const renderStereotypeIcon = (
  bounds: Box,
  stereotypeIcon: UmlStereotypeIcon,
  nodeProps: Pick<NodeProps, 'stroke' | 'fill'>,
  verticalOffset = 0
): VNode | undefined => {
  const x = bounds.x + bounds.w - STEREOTYPE_ICON_SIZE - STEREOTYPE_ICON_PADDING;
  const y = bounds.y + STEREOTYPE_ICON_PADDING + verticalOffset;
  const strokeWidth = Math.max(1, (nodeProps.stroke?.width ?? 1) * 0.9);
  const color = nodeProps.stroke?.color ?? 'currentColor';
  const fillColor =
    nodeProps.fill?.enabled === false
      ? 'var(--canvas-bg)'
      : (nodeProps.fill?.color ?? 'var(--canvas-bg2)');

  const children =
    stereotypeIcon === 'component'
      ? [
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
        ]
      : stereotypeIcon === 'artifact'
        ? [
            svg.path({
              'd':
                'M 2.333,0 L 9.667,0 L 12.667,3 L 12.667,14 L 2.333,14 Z M 9.667,0 L 9.667,3 L 12.667,3',
              'fill': fillColor,
              'stroke': color,
              'stroke-width': strokeWidth,
              'stroke-linejoin': 'round'
            })
          ]
        : undefined;

  if (children === undefined) {
    return undefined;
  }

  return svg.g(
    {
      transform: `translate(${x} ${y})`,
      style: 'pointer-events: none'
    },
    ...children
  );
};
