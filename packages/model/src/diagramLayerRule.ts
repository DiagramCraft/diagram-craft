import type { LayerSnapshot, UnitOfWork } from './unitOfWork';
import type { LayerCRDT } from './diagramLayer';
import { Layer } from './diagramLayer';
import type { Diagram } from './diagram';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { notImplemented } from '@diagram-craft/utils/assert';
import { nodeDefaults } from './diagramDefaults';
import {
  type Adjustment,
  type AdjustmentRule,
  DEFAULT_ADJUSTMENT_RULE
} from './diagramLayerRuleTypes';
import { searchByElementSearchClauses } from './diagramElementSearch';
import { CRDTList, CRDTMap } from './collaboration/crdt';

type Result = Map<string, Adjustment>;

type Prop = { value: string; label: string; type?: string; items?: Prop[] };
export const validProps = (_type: 'edge' | 'node'): Prop[] => {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  const defaultProps = (d: any, path = '') => {
    if (d === null || d === undefined) return [];

    const dest: Prop[] = [];
    for (const key of Object.keys(d)) {
      if (typeof d[key] === 'object') {
        dest.push({
          value: path === '' ? key : `${path}.${key}`,
          label: key,
          items: defaultProps(d[key], path === '' ? key : `${path}.${key}`)
        });
      } else {
        dest.push({
          value: path === '' ? key : `${path}.${key}`,
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
    {
      value: 'props',
      label: 'Style properties',
      items: defaultProps(nodeDefaults.applyDefaults({}), 'renderProps')
    }
  ];
};

export class RuleLayer extends Layer<RuleLayer> {
  #rules: CRDTList<AdjustmentRule>;
  #cache = new Map<string, unknown>();

  constructor(
    id: string,
    name: string,
    diagram: Diagram,
    rules: Readonly<Array<AdjustmentRule>>,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    super(id, name, diagram, 'rule', crdt);

    this.#rules = this.crdt.get('rules', () => diagram.document.root.factory.makeList())!;
    for (const rule of rules) {
      this.#rules.push(rule);
    }

    this.diagram.on('diagramChange', () => this.#cache.clear());
    this.diagram.on('elementChange', () => this.#cache.clear());
    this.diagram.on('elementAdd', () => this.#cache.clear());
    this.diagram.on('elementRemove', () => this.#cache.clear());
  }

  isLocked(): boolean {
    return false;
  }

  resolve() {
    return this;
  }

  adjustments(): Result {
    if (this.#cache.has('result')) return this.#cache.get('result') as Result;

    const res: Result = new Map<string, Adjustment>();
    for (const rule of this.#rules.toArray()) {
      const interim = this.runRule(rule);
      for (const k of interim.keys()) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        res.set(k, deepMerge((res.get(k) ?? {}) as any, interim.get(k) as any));
      }
    }

    this.#cache.set('result', res);

    return res;
  }

  byId(id: string): AdjustmentRule | undefined {
    return this.#rules.toArray().find(r => r.id === id);
  }

  runRule(rule: AdjustmentRule): Result {
    const res: Result = new Map<string, Adjustment>();

    const results = searchByElementSearchClauses(this.diagram, rule.clauses);

    const result = results.reduce((p, c) => p.intersection(c), results[0]!);
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

  get rules() {
    return this.#rules.toArray();
  }

  addRule(rule: AdjustmentRule, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#rules.push(rule);
    uow.updateElement(this);
  }

  removeRule(rule: AdjustmentRule, uow: UnitOfWork) {
    uow.snapshot(this);
    const idx = this.#rules.toArray().findIndex(r => r.id === rule.id);
    this.#rules.delete(idx);
    uow.updateElement(this);
  }

  /*
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
   */

  replaceRule(existing: AdjustmentRule, newRule: AdjustmentRule, uow: UnitOfWork) {
    uow.snapshot(this);

    const idx = this.#rules.toArray().findIndex(r => r.id === existing.id);
    this.#rules.delete(idx);
    this.#rules.insert(idx, [newRule]);

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
    this.#rules.clear();
    this.#rules.transact(() => {
      for (const rule of snapshot.rules ?? []) {
        this.#rules.push(rule);
      }
    });
  }
}
