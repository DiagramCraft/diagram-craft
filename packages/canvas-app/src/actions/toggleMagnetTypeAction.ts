import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { MagnetType } from '@diagram-craft/canvas/snap/magnet';
import { DEFAULT_SNAP_CONFIG, getSnapConfig } from '@diagram-craft/canvas/snap/snapManager';
import { $tStr, type TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toggleMagnetTypeActions> {}
  }
}

export const toggleMagnetTypeActions = (context: ActionContext) => ({
  TOGGLE_MAGNET_TYPE_SIZE: new ToggleMagnetTypeAction(
    'size',
    $tStr('action.TOGGLE_MAGNET_TYPE_SIZE.name', 'Toggle Size Magnet'),
    context
  ),
  TOGGLE_MAGNET_TYPE_GRID: new ToggleMagnetTypeAction(
    'grid',
    $tStr('action.TOGGLE_MAGNET_TYPE_GRID.name', 'Toggle Grid Magnet'),
    context
  ),
  TOGGLE_MAGNET_TYPE_GUIDES: new ToggleMagnetTypeAction(
    'guide',
    $tStr('action.TOGGLE_MAGNET_TYPE_GUIDES.name', 'Toggle Guide Magnet'),
    context
  ),
  TOGGLE_MAGNET_TYPE_CANVAS: new ToggleMagnetTypeAction(
    'canvas',
    $tStr('action.TOGGLE_MAGNET_TYPE_CANVAS.name', 'Toggle Canvas Magnet'),
    context
  ),
  TOGGLE_MAGNET_TYPE_NODE: new ToggleMagnetTypeAction(
    'node',
    $tStr('action.TOGGLE_MAGNET_TYPE_NODE.name', 'Toggle Node Magnet'),
    context
  ),
  TOGGLE_MAGNET_TYPE_DISTANCE: new ToggleMagnetTypeAction(
    'distance',
    $tStr('action.TOGGLE_MAGNET_TYPE_DISTANCE.name', 'Toggle Distance Magnet'),
    context
  )
});

export class ToggleMagnetTypeAction extends AbstractToggleAction {
  constructor(
    private readonly magnetType: MagnetType,
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context);
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
