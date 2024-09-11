import { State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { assert, precondition } from '@diagram-craft/utils/assert';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { newid } from '@diagram-craft/utils/id';

export const ruleLayerActions = (state: State) => ({
  RULE_LAYER_EDIT: new RuleLayerEditAction(state.diagram),
  RULE_LAYER_DELETE: new RuleLayerDeleteAction(state.diagram),
  RULE_LAYER_ADD: new RuleLayerAddAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof ruleLayerActions> {}
}

export class RuleLayerDeleteAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined;
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.id);

    // TODO: Need to change such that it's possible to pass more arguments to the action
    const [layerId, ruleId] = context.id.split(':');

    const layer = this.diagram.layers.byId(layerId) as RuleLayer;
    const rule = layer.byId(ruleId);

    assert.present(rule, 'Rule with id ' + ruleId + ' not found');

    const uow = new UnitOfWork(this.diagram, true);

    layer.removeRule(rule, uow);
    commitWithUndo(uow, 'Delete rule');
  }
}

export class RuleLayerEditAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined;
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.id);

    // TODO: Need to change such that it's possible to pass more arguments to the action
    const [layerId, ruleId] = context.id.split(':');

    const layer = this.diagram.layers.byId(layerId) as RuleLayer;
    const rule = layer.byId(ruleId);

    assert.present(rule, 'Rule with id ' + ruleId + ' not found');

    context.applicationTriggers?.showDialog?.({
      name: 'ruleEditor',
      props: {
        rule: rule
      },
      onCancel: () => {},
      onOk: (rule: AdjustmentRule) => {
        const uow = new UnitOfWork(this.diagram, true);
        layer.replaceRule(rule, rule, uow);
        commitWithUndo(uow, 'Update rule');
      }
    });
  }
}

export class RuleLayerAddAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return (
      context.id !== undefined &&
      this.diagram.layers.byId(context.id) !== undefined &&
      this.diagram.layers.byId(context.id)?.type === 'rule'
    );
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.id);

    const layerId = context.id;

    const layer = this.diagram.layers.byId(layerId) as RuleLayer;
    const rule: AdjustmentRule = {
      id: newid(),
      clauses: [
        {
          id: newid(),
          type: 'props',
          path: 'id',
          relation: 'eq',
          value: ''
        }
      ],
      actions: [],
      type: 'node',
      name: 'New rule'
    };

    assert.present(rule);

    context.applicationTriggers?.showDialog?.({
      name: 'ruleEditor',
      props: {
        rule: rule
      },
      onCancel: () => {},
      onOk: (rule: AdjustmentRule) => {
        const uow = new UnitOfWork(this.diagram, true);
        layer.addRule(rule, uow);
        commitWithUndo(uow, 'Add rule');
      }
    });
  }
}
