import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { Layer, RegularLayer } from './diagramLayer';
import { Diagram } from './diagram';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { parseAndQuery } from '@diagram-craft/query/query';
import { notImplemented } from '@diagram-craft/utils/assert';

export type AdjustmentRule = {
  id: string;
  name: string;
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
      relation: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
      value: string;
    }
);

export type AdjustmentRuleAction = { id: string } & (
  | {
      type: 'set-props';
      props: ElementProps;
    }
  | {
      type: 'set-stylesheet';
      stylesheet: string;
    }
  | {
      type: 'hide';
    }
);

export type Adjustment = NodeProps | EdgeProps;

type Result = Map<string, Adjustment>;

export class RuleLayer extends Layer {
  #rules: Array<AdjustmentRule> = [];
  #cache = new Map<string, unknown>();

  constructor(id: string, name: string, diagram: Diagram, rules: Readonly<Array<AdjustmentRule>>) {
    super(id, name, diagram, 'rule');
    // @ts-ignore
    this.#rules = rules;

    this.diagram.on('change', () => this.#cache.clear());
    this.diagram.on('elementChange', () => this.#cache.clear());
    this.diagram.on('elementAdd', () => this.#cache.clear());
    this.diagram.on('elementRemove', () => this.#cache.clear());
  }

  adjustments(): Result {
    if (this.#cache.has('result')) return this.#cache.get('result') as Result;

    const res: Result = new Map<string, Adjustment>();
    for (const rule of this.#rules) {
      const interim = this.runRule(rule);
      for (const k of interim.keys()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.set(k, deepMerge((res.get(k) ?? {}) as any, interim.get(k) as any));
      }
    }

    this.#cache.set('result', res);

    return res;
  }

  byId(id: string): AdjustmentRule | undefined {
    return this.#rules.find(r => r.id === id);
  }

  runRule(rule: AdjustmentRule): Result {
    const res: Result = new Map<string, Adjustment>();

    const results: Set<string>[] = [];

    for (const clause of rule.clauses) {
      notImplemented.true(clause.type === 'query', 'Not implemented yet');
      if (clause.type === 'query') {
        const r = parseAndQuery(
          clause.query,
          this.diagram.layers.visible.flatMap(l => (l instanceof RegularLayer ? l.elements : []))
        );
        results.push(new Set(...(r as string[])));
      }
    }

    const result = results.reduce((p, c) => p.intersection(c), results[0]);
    for (const k of result) {
      for (const action of rule.actions) {
        notImplemented.true(action.type === 'set-props', 'Not implemented yet');
        if (action.type === 'set-props') {
          if (!res.has(k)) res.set(k, action.props);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          else res.set(k, deepMerge(res.get(k) as any, action.props));
        }
      }
    }
    return res;
  }

  get rules() {
    return this.#rules;
  }

  addRule(rule: AdjustmentRule, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#rules.push(rule);
    uow.updateElement(this);
  }

  removeRule(rule: AdjustmentRule, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#rules = this.#rules.filter(r => r !== rule);
    uow.updateElement(this);
  }

  moveRule(
    rule: AdjustmentRule,
    uow: UnitOfWork,
    ref: { layer: RuleLayer; rule: AdjustmentRule; position: 'before' | 'after' }
  ) {
    // TODO: Support moving to a different AdjustmentLayer
    uow.snapshot(this);
    const index = this.#rules.indexOf(rule);
    const refIndex = this.#rules.indexOf(ref.rule);
    if (index === -1 || refIndex === -1) {
      return;
    }

    this.#rules.splice(index, 1);
    this.#rules.splice(refIndex + (ref.position === 'after' ? 1 : 0), 0, rule);
    uow.updateElement(this);
  }

  snapshot(): LayerSnapshot {
    return {
      ...super.snapshot(),
      rules: deepClone(this.rules)
    };
  }

  restore(snapshot: LayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);
    this.#rules = deepClone(snapshot.rules ?? []);
  }
}
