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
  if (l.resolve()?.type !== 'regular') return false;
  return true;
}

export function isResolvableToRuleLayer(l: Layer): l is Layer<RuleLayer> {
  if (l.resolve()?.type !== 'rule') return false;
  return true;
}

export function isResolvableToModificationLayer(l: Layer): l is Layer<ModificationLayer> {
  if (l.resolve()?.type !== 'modification') return false;
  return true;
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
