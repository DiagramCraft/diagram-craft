import type { Point } from '@diagram-craft/geometry/point';
import type { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { makeIsometricTransform } from './isometric';
import type { Box } from '@diagram-craft/geometry/box';
import type { VNode } from '../component/vdom';
import type { PathRenderer } from '../shape/PathRenderer';

type Effect = {
  isActiveForNode: (props: NodePropsForRendering) => boolean;
  transformPoint?: (bounds: Box, props: NodePropsForRendering, p: Point) => Point;
  getFilter?: (props: NodePropsForRendering) => VNode[];
  getCSSFilter?: () => string | undefined;
  transformShapes?: (shapes: VNode[], props: NodePropsForRendering) => VNode[];
  getPathRenderer?: (props: NodePropsForRendering) => PathRenderer | undefined;
};

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

// Isometric effect
EffectsRegistry.register({
  isActiveForNode: props => props.effects.isometric.enabled,
  transformPoint: (bounds: Box, props: NodePropsForRendering, p: Point) =>
    makeIsometricTransform(bounds, props).point(p)
});
