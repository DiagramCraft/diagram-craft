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
      this.diagram.viewBox.zoom(0.9, this.diagram.viewBox.midpoint);
    } else {
      this.diagram.viewBox.zoom(1.1, this.diagram.viewBox.midpoint);
    }
  }
}
