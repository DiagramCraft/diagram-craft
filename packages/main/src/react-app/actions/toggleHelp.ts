import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
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
  private userState: UserState;

  constructor(context: ActionContext) {
    super(context);

    this.userState = UserState.get();
    this.state = this.userState.showHelp;

    setTimeout(() => {
      document.getElementById('help')!.style.opacity = this.state ? '100' : '0';

      if (!this.state) {
        document.getElementById('help')!.style.display = 'none';
      }
    }, 200);
  }

  execute(): void {
    if (this.state) {
      document.getElementById('help')!.style.opacity = '0';
      setTimeout(() => (document.getElementById('help')!.style.display = 'none'), 500);
      this.state = false;
    } else {
      document.getElementById('help')!.style.opacity = '100';
      document.getElementById('help')!.style.display = 'block';
      this.state = true;
    }

    this.userState.showHelp = this.state;
    this.emit('actionChanged');
  }
}
