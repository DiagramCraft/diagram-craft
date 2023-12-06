import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model-viewer/diagram.ts';
import { ActionEvents, ToggleAction } from '../../base-ui/keyMap.ts';

declare global {
  interface ActionMap {
    ZOOM_IN: ZoomAction;
    ZOOM_OUT: ZoomAction;
  }
}

export class ZoomAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = true;
  state: boolean = false;

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
