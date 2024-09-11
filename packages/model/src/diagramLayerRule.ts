import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { Layer, RegularLayer } from './diagramLayer';
import { Diagram } from './diagram';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { parseAndQuery } from '@diagram-craft/query/query';
import { assert, notImplemented } from '@diagram-craft/utils/assert';
import { nodeDefaults } from './diagramDefaults';
import {
  Adjustment,
  AdjustmentRule,
  AdjustmentRuleClause,
  DEFAULT_ADJUSTMENT_RULE
} from './diagramLayerRuleTypes';

type Result = Map<string, Adjustment>;

type Prop = { value: string; label: string; type?: string; items?: Prop[] };
export const validProps = (_type: 'edge' | 'node'): Prop[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultProps = (d: any, path = '') => {
    if (d === null || d === undefined) return [];

    const dest: Prop[] = [];
    for (const key of Object.keys(d)) {
      if (typeof d[key] === 'object') {
        dest.push({
          value: path === '' ? key : path + '.' + key,
          label: key,
          items: defaultProps(d[key], path === '' ? key : path + '.' + key)
        });
      } else {
        dest.push({
          value: path === '' ? key : path + '.' + key,
          label: key,
          type: typeof d[key]
        });
      }
    }
    return dest;
  };

  return [
    { value: 'id', label: 'ID', type: 'string' },
    { value: 'metadata.name', label: 'Name', type: 'string' },
    { value: 'metadata.style', label: 'Style', type: 'string' },
    { value: 'metadata.textStyle', label: 'Text Style', type: 'string' },
    { value: 'props', label: 'Style properties', items: defaultProps(nodeDefaults, 'renderProps') }
  ];
};

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

  isLocked(): boolean {
    return false;
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

    const results = this.evaluateClauses(rule.clauses);

    const result = results.reduce((p, c) => p.intersection(c), results[0]);
    for (const k of result) {
      for (const action of rule.actions) {
        notImplemented.true(
          action.type === 'set-props' || action.type === 'set-stylesheet' || action.type === 'hide',
          'Not implemented yet'
        );
        if (!res.has(k)) res.set(k, deepClone(DEFAULT_ADJUSTMENT_RULE));

        if (action.type === 'set-props') {
          res.set(k, deepMerge(res.get(k)!, { props: deepClone(action.props) } as Adjustment));
        } else if (action.type === 'set-stylesheet') {
          res.set(
            k,
            deepMerge(res.get(k)!, {
              elementStyle: action.elementStyle,
              textStyle: action.textStyle
            } as Adjustment)
          );
        } else if (action.type === 'hide') {
          res.set(k, deepMerge(res.get(k)!, { props: { hidden: true } } as Adjustment));
        }
      }
    }

    return res;
  }

  private evaluateClauses(clauses: AdjustmentRuleClause[]) {
    const results: Set<string>[] = [];
    for (const clause of clauses) {
      notImplemented.true(
        clause.type === 'query' || clause.type === 'any' || clause.type === 'props',
        'Not implemented yet'
      );
      if (clause.type === 'query') {
        const r = parseAndQuery(
          clause.query,
          this.diagram.layers.visible.flatMap(l => (l instanceof RegularLayer ? l.elements : []))
        );
        results.push(new Set(...(r as string[])));
      } else if (clause.type === 'any') {
        const anyResult = this.evaluateClauses(clause.clauses);
        const result = anyResult.reduce((p, c) => p.union(c), anyResult[0]);
        results.push(result);
      } else if (clause.type === 'props') {
        const re = clause.relation === 'matches' ? new RegExp(clause.value) : undefined;

        const result = new Set<string>();
        for (const layer of this.diagram.layers.visible) {
          if (layer instanceof RegularLayer) {
            for (const element of (layer as RegularLayer).elements) {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const value: any = clause.path.split('.').reduce((p, c) => p[c], element);

              switch (clause.relation) {
                case 'eq':
                  if (value === clause.value) result.add(element.id);
                  break;
                case 'neq':
                  if (value !== clause.value) result.add(element.id);
                  break;
                case 'gt':
                  if (value > clause.value) result.add(element.id);
                  break;
                case 'lt':
                  if (value < clause.value) result.add(element.id);
                  break;
                case 'contains':
                  if (value.includes(clause.value)) result.add(element.id);
                  break;
                case 'matches':
                  assert.present(re);
                  if (re.test(value)) result.add(element.id);
                  break;
                case 'set':
                  if (value) result.add(element.id);
                  break;
              }
            }
          }
        }
        results.push(result);
      }
    }
    return results;
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

  replaceRule(existing: AdjustmentRule, newRule: AdjustmentRule, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#rules = this.#rules.map(r => (r.id !== existing.id ? r : newRule));
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
