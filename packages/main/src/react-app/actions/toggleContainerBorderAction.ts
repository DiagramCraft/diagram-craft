import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';

const HIDE_CONTAINER_CLASS = 'hide_container';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toggleContainerBorderActions> {
    }
  }
}

export const toggleContainerBorderActions = (context: ActionContext) => ({
  TOGGLE_CONTAINER_BORDER: new ToggleContainerBorderAction(context)
});

export class ToggleContainerBorderAction extends AbstractToggleAction {
  name = $tStr('action.TOGGLE_CONTAINER_BORDER.name', 'Container Border');

  constructor(context: ActionContext) {
    super(context);
    setTimeout(() => {
      this.state = !document.body.classList.contains(HIDE_CONTAINER_CLASS);
      this.emit('actionChanged');
    }, 100);
  }

  execute(): void {
    if (this.state) {
      document.body.classList.add(HIDE_CONTAINER_CLASS);
    } else {
      document.body.classList.remove(HIDE_CONTAINER_CLASS);
    }
    this.state = !this.state;
    this.emit('actionChanged');
  }
}
