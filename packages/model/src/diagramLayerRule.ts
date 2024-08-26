import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { Layer } from './diagramLayer';
import { Diagram } from './diagram';
import { deepClone } from '@diagram-craft/utils/object';

export type AdjustmentRule = {
  id: string;
  name: string;
  query: string;
  props: ElementProps;
  metadata: Record<string, unknown>;
};

export type Adjustment = NodeProps | EdgeProps;

export class RuleLayer extends Layer {
  #rules: Array<AdjustmentRule> = [];

  constructor(id: string, name: string, diagram: Diagram, rules: Readonly<Array<AdjustmentRule>>) {
    super(id, name, diagram, 'rule');
    // @ts-ignore
    this.#rules = rules;
  }

  adjustments(): Record<string, Adjustment> {
    return {
      '3': {
        fill: {
          color: 'pink'
        }
      }
    };
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
