import type { UnitOfWork } from './unitOfWork';
import type { LayerCRDT } from './diagramLayer';
import { Layer } from './diagramLayer';
import type { Diagram } from './diagram';
import { deepClone, deepEquals, deepMerge } from '@diagram-craft/utils/object';
import {
  mustExist,
  notImplemented,
  NotImplementedYet,
  VERIFY_NOT_REACHED
} from '@diagram-craft/utils/assert';
import { nodeDefaults } from './diagramDefaults';
import {
  type Adjustment,
  type AdjustmentRule,
  DEFAULT_ADJUSTMENT_RULE
} from './diagramLayerRuleTypes';
import { searchByElementSearchClauses } from './diagramElementSearch';
import type { CRDTList, CRDTMap } from '@diagram-craft/collaboration/crdt';
import { QueryDiagram } from './queryModel';
import { parseAndQuery } from 'embeddable-jq';
import { type DiagramElement, isEdge, isNode } from './diagramElement';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { type Releasable, TimerReleasable } from '@diagram-craft/utils/releasable';
import { LayerSnapshot } from '@diagram-craft/model/diagramLayer.uow';

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

export const queryInput = (diagram: Diagram) => ({
  time: Date.now(),
  diagram: new QueryDiagram(diagram)
});

const RESULT = Symbol('result');

const resultEquals = (a: Result | undefined, b: Result) => {
  if (!a) return false;
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (!b.has(k) || !deepEquals(v, b.get(k)!)) return false;
  }
  return true;
};

type DataTrigger = { rule: string; schema: string };

type TimerTrigger = {
  rule: string;
  timer: ReturnType<typeof setInterval>;
  timeout: number;
  releasable: Releasable;
};

export class RuleLayer extends Layer<RuleLayer> {
  #rules: CRDTList<AdjustmentRule>;
  #cache = new Map<string | symbol, Result>();

  #dependencies = {
    node: new Set<string>(),
    edge: new Set<string>(),
    timers: [] as Array<TimerTrigger>,
    data: new MultiMap<string, DataTrigger>()
  };

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

    this._releasables.add(
      this.#rules.on('remoteAfterTransaction', () => this.updateDependencies())
    );

    this.updateDependencies();

    this._releasables.add(this.diagram.on('diagramChange', () => this.#cache.clear()));
    this._releasables.add(
      this.diagram.on('elementChange', ({ element }) => {
        if (isNode(element)) this.#dependencies.node.forEach(id => this.#cache.delete(id));
        if (isEdge(element)) this.#dependencies.edge.forEach(id => this.#cache.delete(id));
        this.#cache.delete(RESULT);
      })
    );
    this._releasables.add(this.diagram.on('elementAdd', () => this.#cache.delete(RESULT)));
    this._releasables.add(
      this.diagram.on('elementRemove', ({ element }) => {
        if (isNode(element)) this.#dependencies.node.forEach(id => this.#cache.delete(id));
        if (isEdge(element)) this.#dependencies.edge.forEach(id => this.#cache.delete(id));
        this.#cache.delete(RESULT);
      })
    );

    this._releasables.add(
      this.diagram.document.data.db.on('updateData', ({ data }) => {
        const updatedElements = new Set<DiagramElement>();

        const handlers = new Set<DataTrigger>();
        for (const d of data) {
          const schemaHandlers = this.#dependencies.data.get(d._schemaId);
          if (!schemaHandlers) continue;

          for (const handler of schemaHandlers) {
            handlers.add(handler);
          }
        }

        let updates = false;
        for (const h of handlers) {
          const rule = mustExist(this.rules.find(r => r.id === h.rule));
          if (rule.type !== 'advanced') VERIFY_NOT_REACHED();

          const oldResults = this.#cache.get(h.rule);
          const result = this.runRule(rule);

          if (!resultEquals(oldResults, result)) {
            if (rule.debug) {
              console.log(`[RULE] data triggered '${rule.name}' ->`, result);
            }

            updates = true;
            this.#cache.delete(h.rule);

            this.#cache.set(h.rule, result);
            for (const key of Object.keys(result)) {
              const e = this.diagram.lookup(key);
              if (!e) continue;

              e.clearCache();
              updatedElements.add(e);
            }
          } else {
            if (rule.debug) {
              console.log(`[RULE] data triggered '${rule.name}' -> no change`);
            }
          }
        }

        if (updates) {
          this.#cache.delete(RESULT);

          this.diagram.emit('elementBatchChange', {
            added: [],
            removed: [],
            updated: [...updatedElements.values()]
          });
        }
      })
    );
  }

  release(): void {
    super.release();
    this.#cache.clear();
    this.#dependencies.node.clear();
    this.#dependencies.edge.clear();
    this.#dependencies.data.clear();
    this.#dependencies.timers = [];
  }

  private updateDependencies() {
    // Release existing timers
    for (const { releasable } of this.#dependencies.timers) {
      releasable.release();
    }

    // Clear existing dependencies
    this.#dependencies.node.clear();
    this.#dependencies.edge.clear();
    this.#dependencies.data.clear();
    this.#dependencies.timers = [];

    // Re-add dependencies based on the new rules
    for (const rule of this.#rules.toArray()) {
      if (rule.type === 'edge') {
        this.#dependencies.edge.add(rule.id);
      } else if (rule.type === 'node') {
        this.#dependencies.node.add(rule.id);
      } else if (rule.type === 'advanced') {
        for (const trigger of rule.triggers) {
          if (trigger.type === 'interval') {
            const timer = setInterval(() => {
              const oldResult = this.#cache.get(rule.id);
              const result = this.runRule(rule);

              if (!resultEquals(oldResult, result)) {
                if (rule.debug) {
                  console.log(`[RULE] timer triggered '${rule.name}' ->`, result);
                }

                this.#cache.delete(rule.id);
                this.#cache.delete(RESULT);
                this.#cache.set(rule.id, result);

                const elements: DiagramElement[] = [];
                for (const k of result.keys()) {
                  const e = this.diagram.lookup(k);
                  if (!e) continue;

                  elements.push(e);
                  e.clearCache();
                }

                this.diagram.emit('elementBatchChange', {
                  added: [],
                  removed: [],
                  updated: elements
                });
              } else {
                if (rule.debug) {
                  console.log(`[RULE] timer triggered '${rule.name}' -> no change`);
                }
              }
            }, trigger.interval * 1000);

            const releasable = new TimerReleasable(timer, true);
            this._releasables.add(releasable);

            this.#dependencies.timers.push({
              rule: rule.id,
              timer,
              timeout: trigger.interval,
              releasable
            });
          } else if (trigger.type === 'data') {
            this.#dependencies.data.add(trigger.schema, { rule: rule.id, schema: trigger.schema });
          } else if (trigger.type === 'element') {
            if (trigger.elementType === 'node') {
              this.#dependencies.node.add(rule.id);
            } else {
              this.#dependencies.edge.add(rule.id);
            }
          }
        }
      } else {
        VERIFY_NOT_REACHED();
      }
    }
  }

  isLocked(): boolean {
    return false;
  }

  resolve() {
    return this;
  }

  adjustments(): Result {
    if (this.#cache.has(RESULT)) return this.#cache.get(RESULT)!;

    const res: Result = new Map<string, Adjustment>();
    for (const rule of this.#rules.toArray()) {
      const interim = this.#cache.get(rule.id) ?? this.runRule(rule);
      for (const k of interim.keys()) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        res.set(k, deepMerge((res.get(k) ?? {}) as any, interim.get(k) as any));
      }
      this.#cache.set(rule.id, interim);
    }

    this.#cache.set(RESULT, res);

    return res;
  }

  byId(id: string): AdjustmentRule | undefined {
    return this.#rules.toArray().find(r => r.id === id);
  }

  runRule(rule: AdjustmentRule): Result {
    const res: Result = new Map<string, Adjustment>();

    if (rule.type === 'edge' || rule.type === 'node') {
      const results = searchByElementSearchClauses(this.diagram, rule.clauses);

      if (results.length === 0) return res;

      const result = results.reduce((p, c) => p!.intersection(c), results[0]);
      for (const k of result!) {
        for (const action of rule.actions) {
          notImplemented.true(
            action.type === 'set-props' ||
              action.type === 'set-stylesheet' ||
              action.type === 'hide',
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
    } else if (rule.type === 'advanced') {
      const result = new Map<string, Adjustment>();

      try {
        const queryResult = parseAndQuery(rule.rule, [queryInput(this.diagram)]);
        // biome-ignore lint/suspicious/noExplicitAny: valid use for now
        for (const e of queryResult as any[]) {
          if (!e.id) continue;

          result.set(e.id, { props: e.props ?? {} } as Adjustment);
        }
      } catch (error) {
        console.error(`[RULE] Error running rule '${rule.name}':`, error);
      }

      return result;
    } else {
      throw new NotImplementedYet();
    }
  }

  get rules() {
    return this.#rules.toArray();
  }

  addRule(rule: AdjustmentRule, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.#rules.push(rule);
    });
    this.#cache.clear();
    this.updateDependencies();
  }

  removeRule(rule: AdjustmentRule, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      const idx = this.#rules.toArray().findIndex(r => r.id === rule.id);
      this.#rules.delete(idx);
    });
    this.#cache.clear();
    this.updateDependencies();
  }

  replaceRule(existing: AdjustmentRule, newRule: AdjustmentRule, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      const idx = this.#rules.toArray().findIndex(r => r.id === existing.id);
      this.#rules.delete(idx);
      this.#rules.insert(idx, [newRule]);
    });
    this.#cache.clear();
    this.updateDependencies();
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
