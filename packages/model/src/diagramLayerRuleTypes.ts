import type { ElementSearchClause } from './diagramElementSearch';
import type { EdgeProps, ElementProps, NodeProps } from './diagramProps';

export type AdjustmentRule = {
  id: string;
  name: string;
  type: 'edge' | 'node';
  clauses: ElementSearchClause[];
  actions: AdjustmentRuleAction[];
};

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
