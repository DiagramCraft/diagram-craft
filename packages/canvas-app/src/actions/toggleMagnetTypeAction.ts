import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { MagnetType } from '@diagram-craft/canvas/snap/magnet';
import { DEFAULT_SNAP_CONFIG, getSnapConfig } from '@diagram-craft/canvas/snap/snapManager';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toggleMagnetTypeActions> {}
  }
}

export const toggleMagnetTypeActions = (context: ActionContext) => ({
  TOGGLE_MAGNET_TYPE_SIZE: new ToggleMagnetTypeAction('size', context),
  TOGGLE_MAGNET_TYPE_GRID: new ToggleMagnetTypeAction('grid', context),
  TOGGLE_MAGNET_TYPE_GUIDES: new ToggleMagnetTypeAction('guide', context),
  TOGGLE_MAGNET_TYPE_CANVAS: new ToggleMagnetTypeAction('canvas', context),
  TOGGLE_MAGNET_TYPE_NODE: new ToggleMagnetTypeAction('node', context),
  TOGGLE_MAGNET_TYPE_DISTANCE: new ToggleMagnetTypeAction('distance', context)
});

const MAGNET_TYPE_NAME_MAP: Record<MagnetType, string> = {
  'size': 'Toggle Size Magnet',
  'grid': 'Toggle Grid Magnet',
  'guide': 'Toggle Guide Magnet',
  'canvas': 'Toggle Canvas Magnet',
  'node': 'Toggle Node Magnet',
  'distance': 'Toggle Distance Magnet',
  'source': 'Toggle Source Magnet'
};

export class ToggleMagnetTypeAction extends AbstractToggleAction {
  name: string;

  constructor(
    private readonly magnetType: MagnetType,
    context: ActionContext
  ) {
    super(context);
    this.name = MAGNET_TYPE_NAME_MAP[magnetType];
    this.state = getSnapConfig(context.model.activeDiagram).magnetTypes[magnetType] === true;
  }

  getStateCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(context.model.activeDiagram, 'diagramChange', () => {
      return getSnapConfig(context.model.activeDiagram).magnetTypes[this.magnetType] === true;
    });
  }

  execute(): void {
    this.context.model.activeDiagram.updateProps(p => {
      p.snap ??= DEFAULT_SNAP_CONFIG;
      if (this.state) {
        p.snap.magnetTypes[this.magnetType] = false;
      } else {
        p.snap.magnetTypes[this.magnetType] = true;
      }
    });
  }
}
