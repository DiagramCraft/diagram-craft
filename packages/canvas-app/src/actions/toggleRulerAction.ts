import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof toggleRulerActions> {}
}

export const toggleRulerActions = (context: ActionContext) => ({
  TOGGLE_RULER: new ToggleRulerAction(context)
});

export class ToggleRulerAction extends AbstractToggleAction {
  constructor(context: ActionContext) {
    super(context);
  }

  getStateCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram,
      'change',
      () => context.model.activeDiagram.props.ruler?.enabled ?? true
    );
  }

  execute(): void {
    this.context.model.activeDiagram.updateProps(p => {
      p.ruler ??= {};
      p.ruler.enabled = !this.state;
      return p;
    });
  }
}
