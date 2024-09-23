import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

declare global {
  interface ActionMap extends ReturnType<typeof textActions> {}
}

export const textActions = (context: ActionContext) => ({
  TEXT_BOLD: new TextAction('bold', context),
  TEXT_ITALIC: new TextAction('italic', context),
  TEXT_UNDERLINE: new TextDecorationAction('underline', context)
});

// TODO: Maybe we can create an AbstractPropertyAction that takes a prop name and a value and
//       to make all of this a bit more streamlined

export class TextAction extends AbstractToggleAction {
  constructor(
    private readonly prop: 'bold' | 'italic',
    context: ActionContext
  ) {
    super(context);
    const callback = () => {
      if (
        context.model.activeDiagram.selectionState.isNodesOnly() &&
        context.model.activeDiagram.selectionState.nodes.length === 1
      ) {
        const node = context.model.activeDiagram.selectionState.nodes[0];
        this.state = !!node.renderProps.text?.[this.prop];
      }
      this.emit('actionChanged');
    };
    callback();
    context.model.activeDiagram.selectionState.on('add', callback);
    context.model.activeDiagram.selectionState.on('remove', callback);
    context.model.activeDiagram.undoManager.on('execute', callback);
  }

  getCriteria(context: ActionContext) {
    const callback = () => {
      if (
        context.model.activeDiagram.selectionState.isNodesOnly() &&
        context.model.activeDiagram.selectionState.nodes.length === 1
      ) {
        const node = context.model.activeDiagram.selectionState.nodes[0];
        return node.nodeType === 'text';
      } else {
        return false;
      }
    };
    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'add', callback),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'remove', callback),
      ActionCriteria.EventTriggered(context.model.activeDiagram.undoManager, 'execute', callback)
    ];
  }

  execute(): void {
    const node = this.context.model.activeDiagram.selectionState.nodes[0];

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    node.updateProps(p => {
      p.text ??= {};
      p.text[this.prop] ??= false;
      p.text[this.prop] = !p.text[this.prop];
    }, uow);

    commitWithUndo(uow, `Text: ${this.prop}`);

    this.state = !!node.renderProps.text![this.prop];
    this.emit('actionChanged');
  }
}

export class TextDecorationAction extends AbstractToggleAction {
  constructor(
    private readonly prop: 'underline' | 'line-through' | 'overline',
    context: ActionContext
  ) {
    super(context);
    const callback = () => {
      if (
        context.model.activeDiagram.selectionState.isNodesOnly() &&
        context.model.activeDiagram.selectionState.nodes.length === 1
      ) {
        const node = context.model.activeDiagram.selectionState.nodes[0];
        this.state = node.renderProps.text?.textDecoration === this.prop;
      }
      this.emit('actionChanged');
    };
    callback();
    context.model.activeDiagram.selectionState.on('add', callback);
    context.model.activeDiagram.selectionState.on('remove', callback);
    context.model.activeDiagram.undoManager.on('execute', callback);
  }

  getCriteria(context: ActionContext) {
    const callback = () => {
      if (
        context.model.activeDiagram.selectionState.isNodesOnly() &&
        context.model.activeDiagram.selectionState.nodes.length === 1
      ) {
        const node = context.model.activeDiagram.selectionState.nodes[0];
        return node.nodeType === 'text';
      } else {
        return false;
      }
    };
    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'add', callback),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'remove', callback),
      ActionCriteria.EventTriggered(context.model.activeDiagram.undoManager, 'execute', callback)
    ];
  }

  execute(): void {
    const node = this.context.model.activeDiagram.selectionState.nodes[0];

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    node.updateProps(p => {
      p.text ??= {};
      if (p.text.textDecoration === this.prop) {
        p.text.textDecoration = 'none';
      } else {
        p.text.textDecoration = this.prop;
      }
    }, uow);

    commitWithUndo(uow, `Text decoration`);

    this.state = node.renderProps.text!.textDecoration === this.prop;
    this.emit('actionChanged');
  }
}
