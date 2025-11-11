import type { ElementSearchClause } from './diagramElementSearch';

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
      props: DiagramCraft.ElementProps;
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
  props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps;
  textStyle?: string;
  elementStyle?: string;
};

export const DEFAULT_ADJUSTMENT_RULE: Adjustment = {
  props: {}
};
