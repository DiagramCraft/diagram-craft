import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { AbstractAction, ToggleAction } from '../action.ts';

declare global {
  interface ActionMap {
    TOGGLE_RULER: ToggleRulerAction;
  }
}

export const toggleRulerActions: ActionMapFactory = (state: State) => ({
  TOGGLE_RULER: new ToggleRulerAction(state.diagram)
});

export class ToggleRulerAction extends AbstractAction implements ToggleAction {
  state: boolean;

  constructor(private readonly diagram: Diagram) {
    super();
    this.state = diagram.props.ruler?.enabled ?? true;

    this.diagram.on('change', () => {
      this.state = diagram.props.ruler?.enabled ?? true;
      this.emit('actionchanged', { action: this });
    });
  }

  execute(): void {
    this.diagram.props.ruler ??= {};
    if (this.state) {
      this.diagram.props.ruler.enabled = false;
    } else {
      this.diagram.props.ruler.enabled = true;
    }
    this.diagram.update();
  }
}
