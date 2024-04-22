import { AbstractToggleAction } from '@diagram-craft/canvas/action';
import { AppState } from '@diagram-craft/canvas/keyMap';

declare global {
  interface ActionMap {
    TOGGLE_HELP: ToggleHelpAction;
  }
}

export class ToggleHelpAction extends AbstractToggleAction {
  constructor(private readonly appState: AppState) {
    super();

    this.state = appState.userState.showHelp;

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

    this.appState.userState.showHelp = this.state;
    this.emit('actionchanged', { action: this });
  }
}
