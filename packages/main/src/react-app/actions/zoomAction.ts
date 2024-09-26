import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof zoomActions> {}
}

export const zoomActions = (context: ActionContext) => ({
  ZOOM_IN: new ZoomAction('in', context),
  ZOOM_OUT: new ZoomAction('out', context)
});

export class ZoomAction extends AbstractAction {
  constructor(
    private readonly direction: 'in' | 'out',
    context: ActionContext
  ) {
    super(context);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    if (this.direction === 'in') {
      diagram.viewBox.zoom(0.9, diagram.viewBox.midpoint);
    } else {
      diagram.viewBox.zoom(1.1, diagram.viewBox.midpoint);
    }
  }
}
