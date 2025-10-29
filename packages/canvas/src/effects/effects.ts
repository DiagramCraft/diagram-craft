import type { Point } from '@diagram-craft/geometry/point';
import type { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { isometricBaseShape, makeIsometricTransform } from './isometric';
import type { Box } from '@diagram-craft/geometry/box';
import type { VNode } from '../component/vdom';
import { makeBlur } from './blur';
import { makeOpacity } from './opacity';
import { makeShadowFilter } from './shadow';
import { makeReflection } from './reflection';

type Effect = {
  isActiveForNode: (props: NodePropsForRendering) => boolean;
  transformPoint?: (bounds: Box, props: NodePropsForRendering, p: Point) => Point;
  getSVGFilter?: (props: NodePropsForRendering) => VNode[];
  getCSSFilter?: (props: NodePropsForRendering) => string;
  getExtraSVGElements?: (node: DiagramNode, shapeNodes: VNode[]) => VNode[];
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
    makeIsometricTransform(bounds, props).point(p),
  getExtraSVGElements: (node: DiagramNode, _shapeNodes: VNode[]) =>
    isometricBaseShape(
      node.bounds,
      makeIsometricTransform(node.bounds, node.renderProps),
      node.renderProps
    )
});

// Reflection effect
EffectsRegistry.register({
  isActiveForNode: props => !!props.effects.reflection,
  getExtraSVGElements: (node: DiagramNode, shapeNodes: VNode[]) => makeReflection(node, shapeNodes)
});

// Blur effect
EffectsRegistry.register({
  isActiveForNode: props => !!props.effects.blur,
  getSVGFilter: props => [makeBlur(props.effects.blur)]
});

// Opacity effect
EffectsRegistry.register({
  isActiveForNode: props => props.effects.opacity !== 1,
  getSVGFilter: props => [makeOpacity(props.effects.opacity)]
});

// Shadow effect
EffectsRegistry.register({
  isActiveForNode: props => props.shadow.enabled,
  getCSSFilter: props => makeShadowFilter(props.shadow)
});
