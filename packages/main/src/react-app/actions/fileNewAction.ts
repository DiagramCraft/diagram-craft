import { State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';

export const fileNewActions = (_state: State) => ({
  FILE_NEW: new FileNewAction()
});

declare global {
  interface ActionMap extends ReturnType<typeof fileNewActions> {}
}

class FileNewAction extends AbstractAction {
  constructor() {
    super();
  }

  execute(context: ActionContext): void {
    context.applicationTriggers?.newDocument?.();
  }
}
