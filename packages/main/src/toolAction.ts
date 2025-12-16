import { AbstractToggleAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Application } from './application';
import { ToolType } from '@diagram-craft/canvas/tool';
import { $tStr, type TranslatedString } from '@diagram-craft/utils/localize';

export const toolActions = (context: Application) => ({
  TOOL_MOVE: new ToolAction('move', $tStr('action.TOOL_MOVE.name', 'Move Tool'), context),
  TOOL_TEXT: new ToolAction('text', $tStr('action.TOOL_TEXT.name', 'Text Tool'), context),
  TOOL_EDGE: new ToolAction('edge', $tStr('action.TOOL_EDGE.name', 'Edge Tool'), context),
  TOOL_NODE: new ToolAction('node', $tStr('action.TOOL_NODE.name', 'Node Tool'), context),
  TOOL_PEN: new ToolAction('pen', $tStr('action.TOOL_PEN.name', 'Pen Tool'), context),
  TOOL_FREEHAND: new ToolAction(
    'freehand',
    $tStr('action.TOOL_FREEHAND.name', 'Freehand Tool'),
    context
  ),
  TOOL_RECT: new ToolAction('rect', $tStr('action.TOOL_RECT.name', 'Rectangle Tool'), context)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toolActions> {}
  }
}

export class ToolAction extends AbstractToggleAction<undefined, Application> {
  constructor(
    private readonly tool: ToolType,
    public readonly name: TranslatedString,
    context: Application
  ) {
    super(context);
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
