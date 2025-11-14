import type { Point } from '@diagram-craft/geometry/point';
import type { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { isometricBaseShape, makeIsometricTransform } from './isometric';
import type { Box } from '@diagram-craft/geometry/box';
import type { VNode } from '../component/vdom';
import { makeBlur } from './blur';
import { makeOpacity } from './opacity';
import { makeShadowFilter, makeSvgShadowFilter } from './shadow';
import { makeReflection } from './reflection';
import { applySketchEffectToArrow, SketchPathRenderer } from './sketch';
import { RoundingPathRenderer } from './rounding';
import type { ArrowShape } from '../arrowShapes';
import { EffectsRegistry } from '@diagram-craft/model/effect';
import type { PathRenderer } from '../shape/PathRenderer';
import { Browser } from '../browser';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DASH_PATTERNS } from '../dashPatterns';
import * as svg from '../component/vdom-svg';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';

/**
 * Extend Effect interface with rendering methods
 */
declare module '@diagram-craft/model/effect' {
  interface Effect {
    getSVGFilter?: (props: NodePropsForRendering) => VNode[];
    getCSSFilter?: (props: NodePropsForRendering) => string;
    getExtraSVGElements?: (el: DiagramElement, shapeNodes: VNode[]) => VNode[];
    getPathRenderer?: () => PathRenderer;
    getArrowPath?: (id: string, arrow: ArrowShape) => string;
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
    getExtraSVGElements: (el: DiagramElement, _shapeNodes: VNode[]) => {
      const node = el as DiagramNode;
      return isometricBaseShape(
        node.bounds,
        makeIsometricTransform(node.bounds, node.renderProps),
        node.renderProps
      );
    }
  });

  // Reflection effect
  EffectsRegistry.register({
    isUsedForEdge: () => false,
    isUsedForNode: props => !!props.effects?.reflection,
    getExtraSVGElements: (el: DiagramElement, shapeNodes: VNode[]) =>
      makeReflection(el as DiagramNode, shapeNodes)
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
    ...(Browser.isSafari()
      ? {
          getSVGFilter: props => [makeSvgShadowFilter(props.shadow)]
        }
      : {
          getCSSFilter: props => makeShadowFilter(props.shadow)
        })
  });

  // Marching ants animation effect
  EffectsRegistry.register({
    isUsedForNode: () => false,
    isUsedForEdge: props =>
      !!props.stroke?.pattern &&
      props.stroke?.pattern !== 'SOLID' &&
      props.effects?.marchingAnts === true,
    getExtraSVGElements: (el: DiagramElement) => {
      const edge = el as DiagramEdge;
      const props = edge.renderProps;

      // TODO: Perhaps change DASH_PATTERNS to be a list of numbers instead
      const length = DASH_PATTERNS[props.stroke.pattern!]!(
        props.stroke.patternSize / 100,
        props.stroke.patternSpacing / 100
      )
        .split(',')
        .map(e => Number(e.trim()))
        .reduce((a, b) => a + b, 0);

      const duration = 0.2 / (props.effects.marchingAntsSpeed ?? 0.25);

      return [
        svg.animate({
          attributeName: 'stroke-dashoffset',
          values: `${length};0`,
          dur: `${duration}s`,
          repeatCount: 'indefinite'
        })
      ];
    }
  });
};
