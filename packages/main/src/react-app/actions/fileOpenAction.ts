import { AbstractAction, NoopAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { FileDialog } from '../FileDialog';
import { AppConfig } from '../../appConfig';
import { $tStr } from '@diagram-craft/utils/localize';

export const fileOpenActions = (application: Application) =>
  AppConfig.get().filesystem.provider === 'none'
    ? {
        FILE_OPEN: new NoopAction(application)
      }
    : {
        FILE_OPEN: new FileOpenAction(application)
      };

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof fileOpenActions> {}
  }
}

class FileOpenAction extends AbstractAction<unknown, Application> {
  name = $tStr('action.FILE_OPEN.name', 'Open File');

  execute(): void {
    this.context.ui.showDialog(
      FileDialog.create((data: string) => {
        this.context.file.loadDocument(data);
      })
    );
  }
}
