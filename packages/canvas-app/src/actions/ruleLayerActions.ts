import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { assert, precondition } from '@diagram-craft/utils/assert';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { newid } from '@diagram-craft/utils/id';
import { application } from '../application';

export const ruleLayerActions = (state: ActionConstructionParameters) => ({
  RULE_LAYER_EDIT: new RuleLayerEditAction(state.diagram),
  RULE_LAYER_DELETE: new RuleLayerDeleteAction(state.diagram),
  RULE_LAYER_ADD: new RuleLayerAddAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof ruleLayerActions> {}
}

type LayerActionArg = { id?: string };

export class RuleLayerDeleteAction extends AbstractAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    // TODO: This should be a confirm dialog
    application.ui.showMessageDialog?.(
      'Delete layer',
      'Are you sure you want to delete this rule?',
      'Yes',
      'No',
      () => {
        precondition.is.present(id);

        // TODO: Need to change such that it's possible to pass more arguments to the action
        const [layerId, ruleId] = id.split(':');

        const layer = this.diagram.layers.byId(layerId) as RuleLayer;
        const rule = layer.byId(ruleId);

        assert.present(rule, 'Rule with id ' + ruleId + ' not found');

        const uow = new UnitOfWork(this.diagram, true);

        layer.removeRule(rule, uow);
        commitWithUndo(uow, 'Delete rule');
      }
    );
  }
}

export class RuleLayerEditAction extends AbstractAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    // TODO: Need to change such that it's possible to pass more arguments to the action
    const [layerId, ruleId] = id.split(':');

    const layer = this.diagram.layers.byId(layerId) as RuleLayer;
    const rule = layer.byId(ruleId);

    assert.present(rule, 'Rule with id ' + ruleId + ' not found');

    application.ui.showDialog?.({
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

export class RuleLayerAddAction extends AbstractAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return (
      id !== undefined &&
      this.diagram.layers.byId(id) !== undefined &&
      this.diagram.layers.byId(id)?.type === 'rule'
    );
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const layerId = id;

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

    application.ui.showDialog?.({
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
