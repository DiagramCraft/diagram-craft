import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';

export const fileOpenActions = (application: Application) => ({
  FILE_OPEN: new FileOpenAction(application)
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

class FileOpenAction extends AbstractAction<unknown, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    this.context.ui.showDialog?.({
      name: 'fileOpen',
      props: {},
      onOk: data => {
        this.context.ui.loadFromUrl?.(data as string);
      },
      onCancel: () => {}
    });
  }
}
