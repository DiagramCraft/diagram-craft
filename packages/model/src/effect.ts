import type { NodePropsForRendering } from './diagramNode';
import type { EdgePropsForRendering } from './diagramEdge';
import type { Box } from '@diagram-craft/geometry/box';
import type { Point } from '@diagram-craft/geometry/point';

declare global {
  interface Effect {
    isUsedForNode: (props: NodeProps | NodePropsForRendering) => boolean;
    isUsedForEdge: (props: EdgeProps | EdgePropsForRendering) => boolean;
    transformPoint?: (bounds: Box, props: NodePropsForRendering, p: Point) => Point;
  }
}

const effects: Array<[Effect, number]> = [];

export const EffectsRegistry = {
  all: () => effects.map(e => e[0]),
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
