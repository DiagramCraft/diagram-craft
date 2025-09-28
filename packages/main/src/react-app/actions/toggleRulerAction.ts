import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';

declare global {
  interface ActionMap extends ReturnType<typeof toggleRulerActions> {}
}

export const toggleRulerActions = (context: ActionContext) => ({
  TOGGLE_RULER: new ToggleRulerAction(context)
});

export class ToggleRulerAction extends AbstractToggleAction {

  getStateCriteria() {
    return ActionCriteria.EventTriggered(UserState.get(), 'change', () => {
      return UserState.get().showRulers ?? true;
    });
  }

  execute(): void {
    UserState.get().showRulers = !this.state;
    this.emit('actionTriggered');
  }
}
