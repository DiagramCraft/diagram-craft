import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';

declare global {
  namespace DiagramCraft {
    interface ActionMap extends ReturnType<typeof zoomActions> {}
  }
}

export const zoomActions = (context: ActionContext) => ({
  ZOOM_IN: new ZoomAction('in', context),
  ZOOM_OUT: new ZoomAction('out', context),
  ZOOM_FIT: new ZoomFitAction(context)
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

const OFFSET = 40;

class ZoomFitAction extends AbstractAction<{ rulerWidth?: number }> {
  execute(props: { rulerWidth?: number }): void {
    const diagram = this.context.model.activeDiagram;
    // TODO: Use width/height of ruler
    if (diagram.bounds.w > diagram.bounds.h * diagram.viewBox.aspectRatio) {
      diagram.viewBox.dimensions = {
        w: diagram.bounds.w + OFFSET,
        h: (diagram.bounds.w + OFFSET) / diagram.viewBox.aspectRatio
      };
    } else {
      diagram.viewBox.dimensions = {
        w: (diagram.bounds.h + OFFSET) * diagram.viewBox.aspectRatio,
        h: diagram.bounds.h + OFFSET
      };
    }

    const rulerWidth = UserState.get().showRulers ? (props.rulerWidth ?? 0) : 0;

    diagram.viewBox.offset = {
      x: diagram.bounds.x + (diagram.bounds.w - diagram.viewBox.dimensions.w) / 2 - rulerWidth / 2,
      y: diagram.bounds.y + (diagram.bounds.h - diagram.viewBox.dimensions.h) / 2 - rulerWidth / 2
    };
  }
}
