import { DiagramElement } from './diagramElement.ts';
import { Diagram } from './diagram.ts';
import { LayerSnapshot, UnitOfWork } from './unitOfWork.ts';
import { deepClone } from '@diagram-craft/utils';
import { Layer } from './diagramLayer.ts';

export type AdjustmentRule = {
  props: ElementProps;
  query: string;
  metadata: Record<string, unknown>;
};

export class AdjustmentLayer extends Layer {
  #rules: Array<AdjustmentRule> = [];

  constructor(id: string, name: string, elements: ReadonlyArray<DiagramElement>, diagram: Diagram) {
    super(id, name, elements, diagram, 'adjustment');
  }

  matchingRules(_element: DiagramElement): Array<AdjustmentRule> {
    return this.#rules;
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
    ref: { layer: AdjustmentLayer; rule: AdjustmentRule; position: 'before' | 'after' }
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
