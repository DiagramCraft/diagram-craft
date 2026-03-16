import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { Box } from '@diagram-craft/geometry/box';

export type UmlStereotypeIcon = 'empty' | 'component';

const STEREOTYPE_ICON_SIZE = 14;
const STEREOTYPE_ICON_PADDING = 6;

export const UML_STEREOTYPE_ICON_OPTIONS: Array<{ value: UmlStereotypeIcon; label: string }> = [
  { value: 'empty', label: 'Empty' },
  { value: 'component', label: 'Component' }
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
  if (stereotypeIcon !== 'component') {
    return undefined;
  }

  const size = STEREOTYPE_ICON_SIZE;
  const x = bounds.x + bounds.w - size - STEREOTYPE_ICON_PADDING;
  const y = bounds.y + STEREOTYPE_ICON_PADDING + verticalOffset;
  const strokeWidth = Math.max(1, (nodeProps.stroke?.width ?? 1) * 0.9);
  const color = nodeProps.stroke?.color ?? 'currentColor';
  const fillColor =
    nodeProps.fill?.enabled === false ? 'var(--canvas-bg)' : (nodeProps.fill?.color ?? 'var(--canvas-bg2)');
  const scaleX = size / 26;
  const scaleY = size / 21;
  const tx = x - 118.5 * scaleX;
  const ty = y - 5.5 * scaleY;

  return svg.g(
    {
      transform: `translate(${tx} ${ty}) scale(${scaleX} ${scaleY})`,
      style: 'pointer-events: none'
    },
    svg.path({
      d: 'M 124.5,5.5 L 144.5,5.5 L 144.5,26.5 L 124.5,26.5 Z',
      fill: 'none',
      stroke: color,
      'stroke-width': strokeWidth / Math.max(scaleX, scaleY),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }),
    svg.path({
      d: 'M 118.5,9.5 L 130.5,9.5 L 130.5,14.5 L 118.5,14.5 Z',
      fill: fillColor,
      stroke: color,
      'stroke-width': strokeWidth / Math.max(scaleX, scaleY),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }),
    svg.path({
      d: 'M 118.5,17.5 L 130.5,17.5 L 130.5,22.5 L 118.5,22.5 Z',
      fill: fillColor,
      stroke: color,
      'stroke-width': strokeWidth / Math.max(scaleX, scaleY),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    })
  );
};
