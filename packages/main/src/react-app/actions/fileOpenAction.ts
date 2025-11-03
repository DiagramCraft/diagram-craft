import { AbstractAction, NoopAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { FileDialog } from '../FileDialog';
import { AppConfig } from '../../appConfig';

export const fileOpenActions = (application: Application) =>
  AppConfig.get().filesystem.provider === 'none'
    ? {
        FILE_OPEN: new NoopAction(application)
      }
    : {
        FILE_OPEN: new FileOpenAction(application)
      };

declare global {
  interface ActionMap extends ReturnType<typeof fileOpenActions> {}
}

class FileOpenAction extends AbstractAction<unknown, Application> {
  execute(): void {
    this.context.ui.showDialog(
      FileDialog.create((data: string) => {
        this.context.file.loadDocument(data);
      })
    );
  }
}
