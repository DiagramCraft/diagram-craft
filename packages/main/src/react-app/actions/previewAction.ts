import { Application } from '../../application';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof previewActions> {}
  }
}

export const previewActions = (context: Application) => ({
  PREVIEW: new PreviewAction(context)
});

export class PreviewAction extends AbstractAction<void, Application> {
  name = $tStr('action.PREVIEW.name', 'Preview');

  execute(): void {
    this.context.ui.showPreview();
  }
}
