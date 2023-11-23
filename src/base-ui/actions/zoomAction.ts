import { ActionEvents, ToggleAction } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model-viewer/diagram.ts';

declare global {
  interface ActionMap {
    ZOOM_IN: ZoomAction;
    ZOOM_OUT: ZoomAction;
  }
}

// TODO: This should probably move into the app/ folder
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
