import type { LayerSnapshot, UnitOfWork } from './unitOfWork';
import type { LayerCRDT } from './diagramLayer';
import { Layer } from './diagramLayer';
import type { Diagram } from './diagram';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { parseAndQuery } from 'embeddable-jq';
import { assert, notImplemented } from '@diagram-craft/utils/assert';
import { nodeDefaults } from './diagramDefaults';
import {
  type Adjustment,
  type AdjustmentRule,
  type AdjustmentRuleClause,
  DEFAULT_ADJUSTMENT_RULE
} from './diagramLayerRuleTypes';
import { CRDTList, CRDTMap } from './collaboration/crdt';
import { RegularLayer } from './diagramLayerRegular';

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

    this.diagram.on('change', () => this.#cache.clear());
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        clause.type === 'query' ||
          clause.type === 'any' ||
          clause.type === 'props' ||
          clause.type === 'tags' ||
          clause.type === 'comment',
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
      } else if (clause.type === 'tags') {
        const result = new Set<string>();
        for (const layer of this.diagram.layers.visible) {
          if (layer instanceof RegularLayer) {
            for (const element of (layer as RegularLayer).elements) {
              // Check if element has tags property and if any of its tags match the rule tags
              const elementTags = element.tags ?? [];
              const hasMatchingTag = clause.tags.some(ruleTag => elementTags.includes(ruleTag));

              if (hasMatchingTag) {
                result.add(element.id);
              }
            }
          }
        }
        results.push(result);
      } else if (clause.type === 'comment') {
        const allComments = this.diagram.commentManager.getAllCommentsForDiagram(this.diagram);

        const matchingElements = new Set<string>();
        for (const comment of allComments) {
          if (comment.type === 'element' && comment.element) {
            if (
              (clause.state === 'unresolved' && comment.state === 'unresolved') ||
              (clause.state === 'resolved' && comment.state === 'resolved') ||
              clause.state === undefined
            ) {
              matchingElements.add(comment.element.id);
            }
          }
        }

        const result = new Set<string>();
        for (const layer of this.diagram.layers.visible) {
          if (layer instanceof RegularLayer) {
            for (const element of (layer as RegularLayer).elements) {
              if (matchingElements.has(element.id)) {
                result.add(element.id);
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
      ...super.snapshot()
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
