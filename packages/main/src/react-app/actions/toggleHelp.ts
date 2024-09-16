import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';

declare global {
  interface ActionMap extends ReturnType<typeof toggleHelpActions> {}
}

export const toggleHelpActions = (context: ActionContext) => ({
  TOGGLE_HELP: new ToggleHelpAction(context)
});

export class ToggleHelpAction extends AbstractToggleAction {
  private userState: UserState;

  constructor(context: ActionContext) {
    super(context);

    this.userState = UserState.get();
    this.state = this.userState.showHelp;

    setTimeout(() => {
      document.getElementById('help')!.style.opacity = this.state ? '100' : '0';
    }, 200);
  }

  execute(): void {
    if (this.state) {
      document.getElementById('help')!.style.opacity = '0';
      this.state = false;
    } else {
      document.getElementById('help')!.style.opacity = '100';
      this.state = true;
    }

    this.userState.showHelp = this.state;
    this.emit('actionChanged');
  }
}
