import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { application } from '../../application';

export const fileNewActions = (_state: ActionConstructionParameters) => ({
  FILE_NEW: new FileNewAction()
});

declare global {
  interface ActionMap extends ReturnType<typeof fileNewActions> {}
}

class FileNewAction extends AbstractAction {
  constructor() {
    super();
  }

  execute(_context: ActionContext): void {
    application.ui.newDocument?.();
  }
}
