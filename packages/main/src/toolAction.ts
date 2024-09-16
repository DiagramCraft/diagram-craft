import { AbstractToggleAction } from '@diagram-craft/canvas/action';
import { Application } from './application';
import { ToolType } from './tools';

export const toolActions = (context: Application) => ({
  TOOL_MOVE: new ToolAction('move', true, context),
  TOOL_TEXT: new ToolAction('text', undefined, context),
  TOOL_EDGE: new ToolAction('edge', undefined, context),
  TOOL_NODE: new ToolAction('node', undefined, context),
  TOOL_PEN: new ToolAction('pen', undefined, context),
  TOOL_FREEHAND: new ToolAction('freehand', undefined, context),
  TOOL_RECT: new ToolAction('rect', undefined, context)
});

declare global {
  interface ActionMap extends ReturnType<typeof toolActions> {}
}

export class ToolAction extends AbstractToggleAction<undefined, Application> {
  constructor(
    private readonly tool: ToolType,
    defaultState: boolean | undefined,
    context: Application
  ) {
    super(context);
    this.state = defaultState ?? false;
    this.context.tool.on('change', e => {
      const prevState = this.state;
      this.state = e.newValue === tool;
      if (this.state !== prevState) {
        this.emit('actionChanged');
      }
    });
  }

  execute() {
    this.context.tool.set(this.tool);
    this.emit('actionTriggered', {});
  }
}
