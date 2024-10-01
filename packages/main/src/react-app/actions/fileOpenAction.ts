import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { FileDialog } from '../FileDialog';

export const fileOpenActions = (application: Application) => ({
  FILE_OPEN: new FileOpenAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileOpenActions> {}
}

class FileOpenAction extends AbstractAction<unknown, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    this.context.ui.showDialog(
      FileDialog.create((data: string) => {
        this.context.file.loadDocument(data);
      })
    );
  }
}
