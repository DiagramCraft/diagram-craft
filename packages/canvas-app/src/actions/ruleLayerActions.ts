import { AbstractAction } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { assert, precondition } from '@diagram-craft/utils/assert';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { newid } from '@diagram-craft/utils/id';
import { Application } from '../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { RuleEditorDialogCommand } from '../dialogs';
import { safeSplit } from '@diagram-craft/utils/safe';

export const ruleLayerActions = (application: Application) => ({
  RULE_LAYER_EDIT: new RuleLayerEditAction(application),
  RULE_LAYER_DELETE: new RuleLayerDeleteAction(application),
  RULE_LAYER_ADD: new RuleLayerAddAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof ruleLayerActions> {}
  }
}

type LayerActionArg = { id?: string };

export class RuleLayerDeleteAction extends AbstractAction<LayerActionArg, Application> {
  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    // TODO: This should be a confirm dialog
    this.context.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete layer',
          message: 'Are you sure you want to delete this rule?',
          okLabel: 'Yes',
          cancelLabel: 'No'
        },
        () => {
          precondition.is.present(id);

          // TODO: Need to change such that it's possible to pass more arguments to the action
          const [layerId, ruleId] = safeSplit(id, ':', 2);

          const layer = this.context.model.activeDiagram.layers.byId(layerId) as RuleLayer;
          const rule = layer.byId(ruleId);

          assert.present(rule, `Rule with id ${ruleId} not found`);

          const uow = new UnitOfWork(this.context.model.activeDiagram, true);

          layer.removeRule(rule, uow);
          commitWithUndo(uow, 'Delete rule');
        }
      )
    );
  }
}

export class RuleLayerEditAction extends AbstractAction<LayerActionArg, Application> {
  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    // TODO: Need to change such that it's possible to pass more arguments to the action
    const [layerId, ruleId] = safeSplit(id, ':', 2);

    const layer = this.context.model.activeDiagram.layers.byId(layerId) as RuleLayer;
    const rule = layer.byId(ruleId);

    assert.present(rule, `Rule with id ${ruleId} not found`);

    this.context.ui.showDialog(
      new RuleEditorDialogCommand(
        {
          rule: rule
        },
        (rule: AdjustmentRule) => {
          const uow = new UnitOfWork(this.context.model.activeDiagram, true);
          layer.replaceRule(rule, rule, uow);
          commitWithUndo(uow, 'Update rule');
        }
      )
    );
  }
}

export class RuleLayerAddAction extends AbstractAction<LayerActionArg, Application> {
  isEnabled({ id }: LayerActionArg): boolean {
    return (
      id !== undefined &&
      this.context.model.activeDiagram.layers.byId(id) !== undefined &&
      this.context.model.activeDiagram.layers.byId(id)?.type === 'rule'
    );
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const layerId = id;

    const layer = this.context.model.activeDiagram.layers.byId(layerId) as RuleLayer;
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

    this.context.ui.showDialog(
      new RuleEditorDialogCommand(
        {
          rule: rule
        },
        (rule: AdjustmentRule) => {
          const uow = new UnitOfWork(this.context.model.activeDiagram, true);
          layer.addRule(rule, uow);
          commitWithUndo(uow, 'Add rule');
        }
      )
    );
  }
}
