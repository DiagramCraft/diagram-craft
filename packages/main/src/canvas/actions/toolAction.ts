import { ActionMapFactory, AppState } from '../keyMap.ts';
import { ApplicationState, ToolType } from '../ApplicationState.ts';
import { AbstractToggleAction } from '../action.ts';

declare global {
  interface ActionMap {
    TOOL_MOVE: ToolAction;
    TOOL_TEXT: ToolAction;
    TOOL_EDGE: ToolAction;
    TOOL_NODE: ToolAction;
    TOOL_PEN: ToolAction;
  }
}

export const toolActions: ActionMapFactory = (state: AppState) => ({
  TOOL_MOVE: new ToolAction('move', state.applicationState, true),
  TOOL_TEXT: new ToolAction('text', state.applicationState),
  TOOL_EDGE: new ToolAction('edge', state.applicationState),
  TOOL_NODE: new ToolAction('node', state.applicationState),
  TOOL_PEN: new ToolAction('pen', state.applicationState)
});

export class ToolAction extends AbstractToggleAction {
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
