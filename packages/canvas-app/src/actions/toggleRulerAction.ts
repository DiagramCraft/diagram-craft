import { ActionMapFactory, ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractToggleAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

declare global {
  interface ActionMap {
    TOGGLE_RULER: ToggleRulerAction;
  }
}

export const toggleRulerActions: ActionMapFactory = (state: ActionConstructionParameters) => ({
  TOGGLE_RULER: new ToggleRulerAction(state.diagram)
});

export class ToggleRulerAction extends AbstractToggleAction {
  state: boolean;

  constructor(private readonly diagram: Diagram) {
    super();
    this.state = diagram.props.ruler?.enabled ?? true;

    this.diagram.on('change', () => {
      this.state = diagram.props.ruler?.enabled ?? true;
      this.emit('actionchanged', {});
    });
  }

  execute(): void {
    this.diagram.props.ruler ??= {};
    this.diagram.props.ruler.enabled = !this.state;
    this.diagram.update();
  }
}
