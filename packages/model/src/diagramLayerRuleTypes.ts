import type { Diagram } from './diagram';
import { Layer } from './diagramLayer';
import type { RuleLayer } from './diagramLayerRule';
import type { ElementSearchClause } from './diagramElementSearch';

export type AdjustmentRule = {
  id: string;
  name: string;
  type: 'edge' | 'node';
  clauses: ElementSearchClause[];
  actions: AdjustmentRuleAction[];
};

function isResolvableToRuleLayer(l: Layer): l is Layer<RuleLayer> {
  if (l.resolve()?.type !== 'rule') return false;
  return true;
}

export type AdjustmentRuleAction = { id: string } & (
  | {
      type: 'set-props';
      props: ElementProps;
      // where?: 'before' | 'after';
    }
  | {
      type: 'set-stylesheet';
      elementStyle: string;
      textStyle: string;
      //where?: 'before' | 'after';
    }
  | {
      type: 'hide';
      //hideOrphans?: boolean;
    }
);

export type Adjustment = {
  props: NodeProps | EdgeProps;
  textStyle?: string;
  elementStyle?: string;
};

export const DEFAULT_ADJUSTMENT_RULE: Adjustment = {
  props: {}
};

export const getAdjustments = (diagram: Diagram, id: string) => {
  return diagram.layers.visible
    .filter(l => isResolvableToRuleLayer(l))
    .map(
      l =>
        [l.id, l.resolveForced().adjustments().get(id) ?? DEFAULT_ADJUSTMENT_RULE] as [
          string,
          Adjustment
        ]
    );
};
