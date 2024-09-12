import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

export const fileOpenActions = (state: ActionConstructionParameters) => ({
  FILE_OPEN: new FileOpenAction(state.applicationTriggers)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileOpenActions> {}

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      fileOpen: {
        props: Record<string, never>;
        callback: string;
      };
    }
  }
}

class FileOpenAction extends AbstractAction {
  constructor(private readonly applicationTriggers: ApplicationTriggers) {
    super();
  }

  execute(_context: ActionContext): void {
    this.applicationTriggers.showDialog?.({
      name: 'fileOpen',
      props: {},
      onOk: data => {
        this.applicationTriggers.loadFromUrl?.(data as string);
      },
      onCancel: () => {}
    });
  }
}
