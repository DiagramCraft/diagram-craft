import { ActionEvents, ToggleAction } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';

declare global {
  interface ActionMap {
    TOGGLE_DARK_MODE: ToggleDarkModeAction;
  }
}

// TODO: This should probably move into the app/ folder
export class ToggleDarkModeAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = true;
  state: boolean = false;

  constructor() {
    super();
    setTimeout(() => {
      this.state = document.querySelectorAll('.dark-theme').length > 0;
      this.emit('actionchanged', { action: this });
    }, 1000);
  }

  execute(): void {
    if (this.state) {
      document.querySelectorAll('.dark-theme').forEach(element => {
        element.classList.remove('dark-theme');
        element.classList.add('light-theme');
      });
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      this.state = false;
    } else {
      document.querySelectorAll('.light-theme').forEach(element => {
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
