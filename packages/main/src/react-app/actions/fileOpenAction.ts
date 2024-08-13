import { State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';

export const fileOpenActions = (_state: State) => ({
  FILE_OPEN: new FileOpenAction()
});

declare global {
  interface ActionMap extends ReturnType<typeof fileOpenActions> {}
}

class FileOpenAction extends AbstractAction {
  constructor() {
    super();
  }

  execute(context: ActionContext): void {
    context.applicationTriggers?.showDialog?.({
      name: 'fileOpen',
      onOk: data => {
        context.applicationTriggers?.loadFromUrl?.(data as string);
      },
      onCancel: () => {}
    });
  }
}
