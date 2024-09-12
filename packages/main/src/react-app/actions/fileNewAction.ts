import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

export const fileNewActions = (state: ActionConstructionParameters) => ({
  FILE_NEW: new FileNewAction(state.applicationTriggers)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileNewActions> {}
}

class FileNewAction extends AbstractAction {
  constructor(private readonly applicationTriggers: ApplicationTriggers) {
    super();
  }

  execute(_context: ActionContext): void {
    this.applicationTriggers.newDocument?.();
  }
}
