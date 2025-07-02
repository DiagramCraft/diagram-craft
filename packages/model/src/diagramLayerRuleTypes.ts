import { Diagram } from './diagram';
import { isResolvableToRuleLayer } from './diagramLayerRule';

export type AdjustmentRule = {
  id: string;
  name: string;
  type: 'edge' | 'node';
  clauses: AdjustmentRuleClause[];
  actions: AdjustmentRuleAction[];
};

export type AdjustmentRuleClause = { id: string } & (
  | {
      type: 'query';
      query: string;
    }
  | {
      type: 'any';
      clauses: AdjustmentRuleClause[];
    }
  | {
      type: 'props';
      path: string;
      relation: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'matches' | 'set';
      value: string;
    }
);

export type AdjustmentRuleAction = { id: string } & (
  | {
      type: 'set-props';
      props: ElementProps;
      where?: 'before' | 'after';
    }
  | {
      type: 'set-stylesheet';
      elementStyle: string;
      textStyle: string;
      where?: 'before' | 'after';
    }
  | {
      type: 'hide';
      hideOrphans?: boolean;
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
