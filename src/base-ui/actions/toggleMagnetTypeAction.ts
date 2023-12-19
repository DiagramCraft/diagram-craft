import { ActionEvents, ActionMapFactory, State, ToggleAction } from '../keyMap.ts';
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

export const toggleMagnetTypeActions: ActionMapFactory = (state: State) => ({
  TOGGLE_MAGNET_TYPE_SIZE: new ToggleMagnetTypeAction(state.diagram, 'size'),
  TOGGLE_MAGNET_TYPE_GRID: new ToggleMagnetTypeAction(state.diagram, 'grid'),
  TOGGLE_MAGNET_TYPE_CANVAS: new ToggleMagnetTypeAction(state.diagram, 'canvas'),
  TOGGLE_MAGNET_TYPE_NODE: new ToggleMagnetTypeAction(state.diagram, 'node'),
  TOGGLE_MAGNET_TYPE_DISTANCE: new ToggleMagnetTypeAction(state.diagram, 'distance')
});

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
