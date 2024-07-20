import { AbstractToggleAction } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap {
    TOGGLE_DARK_MODE: ToggleDarkModeAction;
  }
}

export class ToggleDarkModeAction extends AbstractToggleAction {
  constructor() {
    super();
    setTimeout(() => {
      this.state = document.querySelectorAll('.dark-theme').length > 0;
      this.emit('actionchanged', { action: this });
    }, 1000);
  }

  execute(): void {
    if (this.state) {
      document.querySelectorAll('.dark-theme:not(.canvas-wrapper)').forEach(element => {
        element.classList.remove('dark-theme');
        element.classList.add('light-theme');
      });
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      this.state = false;
    } else {
      document.querySelectorAll('.light-theme:not(.canvas-wrapper)').forEach(element => {
        if (element.id === 'middle') return;
        element.classList.remove('light-theme');
        element.classList.add('dark-theme');
      });
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      this.state = true;
    }
    this.emit('actionchanged', { action: this });
  }
}
