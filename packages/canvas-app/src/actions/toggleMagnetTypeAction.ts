import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { MagnetType } from '@diagram-craft/model/snap/magnet';
import { DEFAULT_SNAP_CONFIG, getSnapConfig } from '@diagram-craft/model/snap/snapManager';

declare global {
  interface ActionMap extends ReturnType<typeof toggleMagnetTypeActions> {}
}

export const toggleMagnetTypeActions = (context: ActionContext) => ({
  TOGGLE_MAGNET_TYPE_SIZE: new ToggleMagnetTypeAction('size', context),
  TOGGLE_MAGNET_TYPE_GRID: new ToggleMagnetTypeAction('grid', context),
  TOGGLE_MAGNET_TYPE_GUIDES: new ToggleMagnetTypeAction('guide', context),
  TOGGLE_MAGNET_TYPE_CANVAS: new ToggleMagnetTypeAction('canvas', context),
  TOGGLE_MAGNET_TYPE_NODE: new ToggleMagnetTypeAction('node', context),
  TOGGLE_MAGNET_TYPE_DISTANCE: new ToggleMagnetTypeAction('distance', context)
});

export class ToggleMagnetTypeAction extends AbstractToggleAction {
  constructor(
    private readonly magnetType: MagnetType,
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
