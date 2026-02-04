import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toggleDarkModeActions> {}
  }
}

export const toggleDarkModeActions = (context: ActionContext) => ({
  TOGGLE_DARK_MODE: new ToggleDarkModeAction(context)
});

export class ToggleDarkModeAction extends AbstractToggleAction {
  name = $tStr('action.TOGGLE_DARK_MODE.name', 'Toggle Dark Mode');

  constructor(context: ActionContext) {
    super(context);
    setTimeout(() => {
      this.state = document.querySelectorAll('.dark-theme').length > 0;
      this.emit('actionChanged');
    }, 1000);
  }

  execute(): void {
    if (this.state) {
      document.querySelectorAll('.dark-theme:not(.canvas)').forEach(element => {
        element.classList.remove('dark-theme');
        element.classList.add('light-theme');
      });
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      this.state = false;
    } else {
      document.querySelectorAll('.light-theme:not(.canvas)').forEach(element => {
        if (element.id === 'middle') return;
        element.classList.remove('light-theme');
        element.classList.add('dark-theme');
      });
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      this.state = true;
    }
    this.emit('actionChanged');
  }
}
