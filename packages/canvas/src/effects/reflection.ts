import * as svg from '../component/vdom-svg';
import { Angle } from '@diagram-craft/geometry/angle';
import { resilientDeepClone } from '@diagram-craft/utils/object';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { VNode } from '../component/vdom';

export const makeReflection = (node: DiagramNode, children: VNode[]) => {
  const id = node.id;
  const bounds = node.bounds;
  const props = node.renderProps;

  const center = Box.center(bounds);

  let pathBounds: Box | undefined;
  if (props.effects?.reflection) {
    const paths = node.diagram.document.registry.nodes.get(node.nodeType).getBoundingPath(node);

    pathBounds = paths.bounds();
  }

  const strength = node.renderProps.effects?.reflectionStrength?.toString() ?? '1';

  return [
    svg.linearGradient(
      {
        id: `reflection-grad-${id}`,
        y2: '1',
        x2: '0',
        gradientUnits: 'objectBoundingBox',
        gradientTransform: `rotate(${-Angle.toDeg(bounds.r)} 0.5 0.5)`
      },
      svg.stop({ 'offset': '0.65', 'stop-color': 'white', 'stop-opacity': '0' }),
      svg.stop({ 'offset': '1', 'stop-color': 'white', 'stop-opacity': strength })
    ),
    svg.mask(
      {
        id: `reflection-mask-${id}`,
        maskContentUnits: 'objectBoundingBox'
      },
      svg.rect({
        width: '1',
        height: '1',
        fill: `url(#reflection-grad-${id})`
      })
    ),
    svg.g(
      {
        transform: `
          rotate(${-Angle.toDeg(bounds.r)} ${center.x} ${center.y})
          scale(1 -1)
          translate(0 -${2 * (pathBounds!.y + pathBounds!.h)})
          rotate(${Angle.toDeg(bounds.r)} ${center.x} ${center.y})
        `,
        mask: `url(#reflection-mask-${id})`,
        style: `filter: url(#reflection-filter); pointer-events: none`
      },

      // TODO: This means text is not reflected, but if we don't filter it out
      //       there's an infinite recursion
      ...children.filter(e => !e.tag.startsWith('text_')).map(e => resilientDeepClone(e))
    )
  ];
};
