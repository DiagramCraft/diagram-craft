import type { NodePropsForRendering } from './diagramNode';
import type { EdgePropsForRendering } from './diagramEdge';
import type { Box } from '@diagram-craft/geometry/box';
import type { Point } from '@diagram-craft/geometry/point';
import type { EdgeProps, NodeProps } from './diagramProps';

export interface Effect {
  isUsedForNode: (props: NodeProps | NodePropsForRendering) => boolean;
  isUsedForEdge: (props: EdgeProps | EdgePropsForRendering) => boolean;
  transformPoint?: (bounds: Box, props: NodePropsForRendering, p: Point) => Point;
}

const effects: Array<[Effect, number]> = [];

export const EffectsRegistry = {
  all: () => effects.map(e => e[0]),
  get: <K extends keyof Effect>(
    nodeProps: NodeProps | NodePropsForRendering | undefined,
    edgeProps: EdgeProps | EdgePropsForRendering | undefined,
    fn: K
  ): Array<Omit<Effect, K> & Required<Pick<Effect, K>>> => {
    return effects
      .map(e => e[0])
      .filter(
        e => (nodeProps && e.isUsedForNode(nodeProps)) || (edgeProps && e.isUsedForEdge(edgeProps))
      )
      .filter(e => e[fn]) as unknown as Array<Omit<Effect, K> & Required<Pick<Effect, K>>>;
  },
  register: (effect: Effect, priority = 0) => {
    // Find the correct insertion index based on priority
    let insertIndex = effects.length;
    for (let i = 0; i < effects.length; i++) {
      if (effects[i]![1] < priority) {
        insertIndex = i;
        break;
      }
    }

    // Insert the effect at the calculated index
    effects.splice(insertIndex, 0, [effect, priority]);
  }
};
