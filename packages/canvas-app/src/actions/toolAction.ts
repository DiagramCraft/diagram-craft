import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { ApplicationState, ToolType } from '@diagram-craft/canvas/ApplicationState';
import { AbstractToggleAction } from '@diagram-craft/canvas/action';

export const toolActions = (state: ActionConstructionParameters) => ({
  TOOL_MOVE: new ToolAction('move', state.applicationState, true),
  TOOL_TEXT: new ToolAction('text', state.applicationState),
  TOOL_EDGE: new ToolAction('edge', state.applicationState),
  TOOL_NODE: new ToolAction('node', state.applicationState),
  TOOL_PEN: new ToolAction('pen', state.applicationState),
  TOOL_FREEHAND: new ToolAction('freehand', state.applicationState),
  TOOL_RECT: new ToolAction('rect', state.applicationState)
});

declare global {
  interface ActionMap extends ReturnType<typeof toolActions> {}
}

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
      this.state = e.tool === tool;
      if (this.state !== prevState) {
        this.emit('actionchanged', {});
      }
    });
  }

  execute() {
    this.applicationState.tool = this.tool;
    this.emit('actiontriggered', {});
  }
}
