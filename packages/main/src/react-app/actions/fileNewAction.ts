import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';

export const fileNewActions = (application: Application) => ({
  FILE_NEW: new FileNewAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileNewActions> {}
}

class FileNewAction extends AbstractAction<undefined, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    this.context.file.newDocument();
  }
}
