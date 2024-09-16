import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof toggleRulerActions> {}
}

export const toggleRulerActions = (context: ActionContext) => ({
  TOGGLE_RULER: new ToggleRulerAction(context)
});

export class ToggleRulerAction extends AbstractToggleAction {
  state: boolean;

  constructor(context: ActionContext) {
    super(context);
    this.state = context.model.activeDiagram.props.ruler?.enabled ?? true;

    this.context.model.activeDiagram.on('change', () => {
      this.state = context.model.activeDiagram.props.ruler?.enabled ?? true;
      this.emit('actionChanged');
    });
  }

  execute(): void {
    this.context.model.activeDiagram.props.ruler ??= {};
    this.context.model.activeDiagram.props.ruler.enabled = !this.state;
    this.context.model.activeDiagram.update();
  }
}
