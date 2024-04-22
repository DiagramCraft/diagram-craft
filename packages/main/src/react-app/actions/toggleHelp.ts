import { AbstractToggleAction } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap {
    TOGGLE_HELP: ToggleHelpAction;
  }
}

export class ToggleHelpAction extends AbstractToggleAction {
  constructor() {
    super();
    setTimeout(() => {
      this.state = document.getElementById('status')!.style.visibility !== 'hidden' ? true : false;
      this.emit('actionchanged', { action: this });
    }, 1000);
  }

  execute(): void {
    if (this.state) {
      document.getElementById('status')!.style.visibility = 'hidden';
      this.state = false;
    } else {
      document.getElementById('status')!.style.visibility = 'visible';
      this.state = true;
    }
    this.emit('actionchanged', { action: this });
  }
}
