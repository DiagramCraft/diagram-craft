import type { RegularLayer } from './diagramLayerRegular';
import type { Layer } from './diagramLayer';
import type { RuleLayer } from './diagramLayerRule';
import type { ModificationLayer } from './diagramLayerModification';
import type { Diagram } from './diagram';
import { type Adjustment, DEFAULT_ADJUSTMENT_RULE } from './diagramLayerRuleTypes';

export function assertRegularLayer(l: Layer): asserts l is RegularLayer {
  if (l.type !== 'regular') {
    throw new Error('Layer is not a regular layer');
  }
}

export function assertRegularOrModificationLayer(
  l: Layer
): asserts l is RegularLayer | ModificationLayer {
  if (l.type !== 'regular' && l.type !== 'modification') {
    throw new Error('Layer is not a regular or modification layer');
  }
}

export function isRegularLayer(l: Layer): l is RegularLayer {
  return l.type === 'regular';
}

export function isResolvableToRegularLayer(l: Layer): l is Layer<RegularLayer> {
  return l.resolve()?.type === 'regular';
}

export function isResolvableToRuleLayer(l: Layer): l is Layer<RuleLayer> {
  return l.resolve()?.type === 'rule';
}

export function isResolvableToModificationLayer(l: Layer): l is Layer<ModificationLayer> {
  return l.resolve()?.type === 'modification';
}

export const getAdjustments = (diagram: Diagram, id: string) => {
  return diagram.layers.visible
    .filter(l => isResolvableToRuleLayer(l) || isResolvableToModificationLayer(l))
    .map(
      l =>
        [l.id, l.resolveForced().adjustments().get(id) ?? DEFAULT_ADJUSTMENT_RULE] as [
          string,
          Adjustment
        ]
    );
};
