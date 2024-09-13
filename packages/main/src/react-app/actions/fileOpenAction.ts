import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { application } from '../../application';

export const fileOpenActions = (_state: ActionConstructionParameters) => ({
  FILE_OPEN: new FileOpenAction()
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
  constructor() {
    super();
  }

  execute(): void {
    application.ui.showDialog?.({
      name: 'fileOpen',
      props: {},
      onOk: data => {
        application.ui.loadFromUrl?.(data as string);
      },
      onCancel: () => {}
    });
  }
}
