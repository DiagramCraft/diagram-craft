import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { MagnetType } from '@diagram-craft/model/snap/magnet';

declare global {
  interface ActionMap extends ReturnType<typeof toggleMagnetTypeActions> {}
}

export const toggleMagnetTypeActions = (context: ActionContext) => ({
  TOGGLE_MAGNET_TYPE_SIZE: new ToggleMagnetTypeAction('size', context),
  TOGGLE_MAGNET_TYPE_GRID: new ToggleMagnetTypeAction('grid', context),
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
    this.state = context.model.activeDiagram.snapManagerConfig.magnetTypes.includes(magnetType);
  }

  getStateCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.snapManagerConfig,
      'change',
      () => {
        return context.model.activeDiagram.snapManagerConfig.magnetTypes.includes(this.magnetType);
      }
    );
  }

  execute(): void {
    const snapMgr = this.context.model.activeDiagram.snapManagerConfig;
    if (this.state) {
      snapMgr.magnetTypes = snapMgr.magnetTypes.filter(type => type !== this.magnetType);
    } else {
      snapMgr.magnetTypes = [...snapMgr.magnetTypes, this.magnetType];
    }
    snapMgr.commit();
  }
}
