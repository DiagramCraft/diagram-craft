import { ActionEvents, ToggleAction } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { MagnetType } from '../../model/snap/magnet.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    TOGGLE_MAGNET_TYPE_SIZE: ToggleMagnetTypeAction;
    TOGGLE_MAGNET_TYPE_GRID: ToggleMagnetTypeAction;
    TOGGLE_MAGNET_TYPE_CANVAS: ToggleMagnetTypeAction;
    TOGGLE_MAGNET_TYPE_NODE: ToggleMagnetTypeAction;
    TOGGLE_MAGNET_TYPE_DISTANCE: ToggleMagnetTypeAction;
  }
}

export class ToggleMagnetTypeAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = false;
  state: boolean;

  constructor(
    private readonly diagram: Diagram,
    private readonly magnetType: MagnetType
  ) {
    super();
    this.state = diagram.snapManagerConfig.magnetTypes.includes(magnetType);

    this.diagram.snapManagerConfig.on('change', () => {
      this.state = diagram.snapManagerConfig.magnetTypes.includes(magnetType);
      this.emit('actionchanged', { action: this });
    });
  }

  execute(): void {
    if (this.state) {
      this.diagram.snapManagerConfig.magnetTypes =
        this.diagram.snapManagerConfig.magnetTypes.filter(type => type !== this.magnetType);
    } else {
      this.diagram.snapManagerConfig.magnetTypes = [
        ...this.diagram.snapManagerConfig.magnetTypes,
        this.magnetType
      ];
    }
    this.diagram.snapManagerConfig.commit();
  }
}
