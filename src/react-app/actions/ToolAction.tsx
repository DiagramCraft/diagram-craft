import { EventEmitter } from '../../utils/event.ts';
import { ActionEvents, ActionMapFactory, AppState, ToggleAction } from '../../base-ui/keyMap.ts';
import { ApplicationState, ToolType } from '../../base-ui/ApplicationState.ts';

declare global {
  interface ActionMap {
    TOOL_MOVE: ToolAction;
    TOOL_TEXT: ToolAction;
  }
}

export const toolActions: ActionMapFactory = (state: AppState) => ({
  TOOL_MOVE: new ToolAction('move', state.applicationState, true),
  TOOL_TEXT: new ToolAction('text', state.applicationState)
});

export class ToolAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = true;
  state = false;

  constructor(
    private readonly tool: ToolType,
    private readonly applicationState: ApplicationState,
    defaultState?: boolean
  ) {
    super();
    this.state = defaultState ?? false;
    this.applicationState.on('toolChange', e => {
      const prevState = this.state;
      if (e.tool === tool) {
        this.state = true;
      } else {
        this.state = false;
      }
      if (this.state !== prevState) {
        this.emit('actionchanged', { action: this });
      }
    });
  }

  execute() {
    this.applicationState.tool = this.tool;
    this.emit('actiontriggered', { action: this });
  }
}
