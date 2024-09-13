import { AbstractToggleAction } from '@diagram-craft/canvas/action';
import { UserState } from '@diagram-craft/canvas/UserState';

declare global {
  interface ActionMap {
    TOGGLE_HELP: ToggleHelpAction;
  }
}

export class ToggleHelpAction extends AbstractToggleAction {
  private userState: UserState;

  constructor() {
    super();

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
