import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toggleHelpActions> {}
  }
}

export const toggleHelpActions = (context: ActionContext) => ({
  TOGGLE_HELP: new ToggleHelpAction(context)
});

export class ToggleHelpAction extends AbstractToggleAction {
  name = $tStr('action.TOGGLE_HELP.name', 'Toggle Help');

  getStateCriteria() {
    return ActionCriteria.EventTriggered(UserState.get(), 'change', () => {
      return UserState.get().showHelp ?? true;
    });
  }

  execute(): void {
    UserState.get().showHelp = !this.state;
    this.emit('actionTriggered');
  }
}
