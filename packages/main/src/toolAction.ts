import { AbstractToggleAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Application } from './application';
import { ToolType } from '@diagram-craft/canvas/tool';

export const toolActions = (context: Application) => ({
  TOOL_MOVE: new ToolAction('move', context),
  TOOL_TEXT: new ToolAction('text', context),
  TOOL_EDGE: new ToolAction('edge', context),
  TOOL_NODE: new ToolAction('node', context),
  TOOL_PEN: new ToolAction('pen', context),
  TOOL_FREEHAND: new ToolAction('freehand', context),
  TOOL_RECT: new ToolAction('rect', context)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toolActions> {}
  }
}

const TOOL_NAME_MAP: Record<ToolType, string> = {
  'move': 'Move Tool',
  'text': 'Text Tool',
  'edge': 'Edge Tool',
  'node': 'Node Tool',
  'pen': 'Pen Tool',
  'freehand': 'Freehand Tool',
  'rect': 'Rectangle Tool'
};

export class ToolAction extends AbstractToggleAction<undefined, Application> {
  name: string;

  constructor(
    private readonly tool: ToolType,
    context: Application
  ) {
    super(context);
    this.name = TOOL_NAME_MAP[tool] ?? `${tool} Tool`;
    this.state = context.tool.value === tool;
  }

  getStateCriteria(context: Application) {
    return ActionCriteria.EventTriggered(context.tool, 'change', () => {
      return context.tool.value === this.tool;
    });
  }

  getCriteria(context: Application) {
    if (this.tool === 'move') return [];
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.layers,
      'layerStructureChange',
      () =>
        context.model.activeDiagram.activeLayer.type === 'regular' &&
        !context.model.activeDiagram.activeLayer.isLocked()
    );
  }

  execute() {
    this.context.tool.set(this.tool);
    this.emit('actionTriggered', {});
  }
}
