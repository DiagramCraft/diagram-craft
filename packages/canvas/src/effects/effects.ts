import type { Point } from '@diagram-craft/geometry/point';
import type { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { isometricBaseShape, makeIsometricTransform } from './isometric';
import type { Box } from '@diagram-craft/geometry/box';
import type { VNode } from '../component/vdom';
import { makeBlur } from './blur';
import { makeOpacity } from './opacity';
import { makeShadowFilter } from './shadow';
import { makeReflection } from './reflection';
import { applySketchEffectToArrow, SketchPathRenderer } from './sketch';
import type { PathRenderer } from '../shape/PathRenderer';
import { RoundingPathRenderer } from './rounding';
import type { ArrowShape } from '../arrowShapes';
import { EffectsRegistry } from '@diagram-craft/model/effect';

declare global {
  namespace DiagramCraft {
    interface Effect {
      getSVGFilter?: (props: NodePropsForRendering) => VNode[];
      getCSSFilter?: (props: NodePropsForRendering) => string;
      getExtraSVGElements?: (node: DiagramNode, shapeNodes: VNode[]) => VNode[];
      getPathRenderer?: () => PathRenderer;
      getArrowPath?: (id: string, arrow: ArrowShape) => string;
    }
  }
}

export const registerDefaultEffects = () => {
  // Sketch effect
  EffectsRegistry.register(
    {
      isUsedForEdge: props => !!props.effects?.sketch,
      isUsedForNode: props => !!props.effects?.sketch,
      getPathRenderer: () => new SketchPathRenderer(),
      getArrowPath: (id: string, arrow: ArrowShape) => applySketchEffectToArrow(id, arrow)
    },
    100
  );

  // Rounding effect
  EffectsRegistry.register({
    isUsedForEdge: props => !!props.effects?.rounding,
    isUsedForNode: props => !!props.effects?.rounding,
    getPathRenderer: () => new RoundingPathRenderer()
  });

  // Isometric effect
  EffectsRegistry.register({
    isUsedForEdge: () => false,
    isUsedForNode: props => !!props.effects?.isometric?.enabled,
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
    isUsedForEdge: () => false,
    isUsedForNode: props => !!props.effects?.reflection,
    getExtraSVGElements: (node: DiagramNode, shapeNodes: VNode[]) =>
      makeReflection(node, shapeNodes)
  });

  // Blur effect
  EffectsRegistry.register({
    isUsedForEdge: () => false,
    isUsedForNode: props => !!props.effects?.blur,
    getSVGFilter: props => [makeBlur(props.effects.blur)]
  });

  // Opacity effect
  EffectsRegistry.register({
    isUsedForEdge: () => false,
    isUsedForNode: props => props.effects?.opacity !== 1,
    getSVGFilter: props => [makeOpacity(props.effects.opacity)]
  });

  // Shadow effect
  EffectsRegistry.register({
    isUsedForEdge: () => false,
    isUsedForNode: props => !!props.shadow?.enabled,
    getCSSFilter: props => makeShadowFilter(props.shadow)
  });
};
