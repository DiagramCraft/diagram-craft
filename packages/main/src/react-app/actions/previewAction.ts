import { Application } from '../../application';
import { AbstractAction } from '@diagram-craft/canvas/action';

declare global {
  namespace DiagramCraft {
    interface ActionMap extends ReturnType<typeof previewActions> {}
  }
}

export const previewActions = (context: Application) => ({
  PREVIEW: new PreviewAction(context)
});

export class PreviewAction extends AbstractAction<void, Application> {
  execute(): void {
    this.context.ui.showPreview();
  }
}
