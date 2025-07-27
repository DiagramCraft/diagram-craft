import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';

declare global {
  interface ActionMap extends ReturnType<typeof toggleRulerActions> {}
}

export const toggleRulerActions = (context: ActionContext) => ({
  TOGGLE_RULER: new ToggleRulerAction(context)
});

export class ToggleRulerAction extends AbstractToggleAction {
  private userState: UserState | undefined;

  constructor(context: ActionContext) {
    super(context);
    this.userState = UserState.get();
  }

  getStateCriteria() {
    return ActionCriteria.EventTriggered(
      this.userState!,
      'change',
      () => this.userState?.showRulers ?? true
    );
  }

  execute(): void {
    this.context.model.activeDiagram.updateProps(p => {
      this.userState!.showRulers = !this.state;
      return p;
    });
    this.state = !this.state;
  }
}
