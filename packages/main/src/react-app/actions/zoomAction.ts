import { AbstractToggleAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

declare global {
  interface ActionMap {
    ZOOM_IN: ZoomAction;
    ZOOM_OUT: ZoomAction;
  }
}

export class ZoomAction extends AbstractToggleAction {
  constructor(
    private readonly diagram: Diagram,
    private readonly direction: 'in' | 'out'
  ) {
    super();
  }

  execute(): void {
    if (this.direction === 'in') {
      this.diagram.viewBox.zoom(this.diagram.viewBox.midpoint, 1.1);
    } else {
      this.diagram.viewBox.zoom(this.diagram.viewBox.midpoint, 0.9);
    }
  }
}
