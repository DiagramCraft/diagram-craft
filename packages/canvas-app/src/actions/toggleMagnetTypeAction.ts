import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
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
  state: boolean;

  constructor(
    private readonly magnetType: MagnetType,
    context: ActionContext
  ) {
    super(context);
    this.state = context.model.activeDiagram.snapManagerConfig.magnetTypes.includes(magnetType);

    this.context.model.activeDiagram.snapManagerConfig.on('change', () => {
      this.state = context.model.activeDiagram.snapManagerConfig.magnetTypes.includes(magnetType);
      this.emit('actionChanged');
    });
  }

  execute(): void {
    if (this.state) {
      this.context.model.activeDiagram.snapManagerConfig.magnetTypes =
        this.context.model.activeDiagram.snapManagerConfig.magnetTypes.filter(
          type => type !== this.magnetType
        );
    } else {
      this.context.model.activeDiagram.snapManagerConfig.magnetTypes = [
        ...this.context.model.activeDiagram.snapManagerConfig.magnetTypes,
        this.magnetType
      ];
    }
    this.context.model.activeDiagram.snapManagerConfig.commit();
  }
}
