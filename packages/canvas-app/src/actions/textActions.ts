import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Application } from '../application';
import { StringInputDialogCommand } from '../dialogs';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { $tStr, type TranslatedString } from '@diagram-craft/utils/localize';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof textActions> {}
  }
}

export const textActions = (context: Application) => ({
  TEXT_BOLD: new TextAction('bold', $tStr('action.TEXT_BOLD.name', 'Bold'), context),
  TEXT_ITALIC: new TextAction('italic', $tStr('action.TEXT_ITALIC.name', 'Italic'), context),
  TEXT_UNDERLINE: new TextDecorationAction(
    'underline',
    $tStr('action.TEXT_UNDERLINE.name', 'Underline'),
    context
  ),
  TEXT_EDIT: new TextEditAction(context)
});

// TODO: Maybe we can create an AbstractPropertyAction that takes a prop name and a value and
//       to make all of this a bit more streamlined

export class TextAction extends AbstractToggleAction {
  constructor(
    private readonly prop: 'bold' | 'italic',
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context);
  }

  getStateCriteria(context: ActionContext) {
    const $d = context.model.activeDiagram;

    const callback = () => {
      if ($d.selection.isNodesOnly() && $d.selection.nodes.length === 1) {
        const node = $d.selection.nodes[0]!;
        return !!node.renderProps.text[this.prop];
      }

      return false;
    };

    return [
      ActionCriteria.EventTriggered($d.selection, 'add', callback),
      ActionCriteria.EventTriggered($d.selection, 'remove', callback),
      ActionCriteria.EventTriggered($d.undoManager, 'execute', callback)
    ];
  }

  getCriteria(context: ActionContext) {
    const $d = context.model.activeDiagram;

    const callback = () => {
      if ($d.selection.isNodesOnly() && $d.selection.nodes.length === 1) {
        const node = $d.selection.nodes[0]!;
        return node.nodeType === 'text';
      }

      return false;
    };
    return [
      ActionCriteria.EventTriggered($d.selection, 'add', callback),
      ActionCriteria.EventTriggered($d.selection, 'remove', callback),
      ActionCriteria.EventTriggered($d.undoManager, 'execute', callback)
    ];
  }

  execute(): void {
    const node = this.context.model.activeDiagram.selection.nodes[0]!;

    UnitOfWork.executeWithUndo(this.context.model.activeDiagram, `Text: ${this.prop}`, uow => {
      node.updateProps(p => {
        p.text ??= {};
        p.text[this.prop] ??= false;
        p.text[this.prop] = !node.renderProps.text[this.prop];
      }, uow);
    });

    this.state = !!node.renderProps.text[this.prop];
    this.emit('actionChanged');
  }
}

export class TextDecorationAction extends AbstractToggleAction {
  constructor(
    private readonly prop: 'underline' | 'line-through' | 'overline',
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context);
  }

  getStateCriteria(context: ActionContext) {
    const $d = context.model.activeDiagram;
    const callback = () => {
      if ($d.selection.isNodesOnly() && $d.selection.nodes.length === 1) {
        const node = $d.selection.nodes[0]!;
        return node.renderProps.text?.textDecoration === this.prop;
      }
      return false;
    };
    return [
      ActionCriteria.EventTriggered($d.selection, 'add', callback),
      ActionCriteria.EventTriggered($d.selection, 'remove', callback),
      ActionCriteria.EventTriggered($d.undoManager, 'execute', callback)
    ];
  }

  getCriteria(context: ActionContext) {
    const $d = context.model.activeDiagram;
    const callback = () => {
      if ($d.selection.isNodesOnly() && $d.selection.nodes.length === 1) {
        const node = $d.selection.nodes[0]!;
        return node.nodeType === 'text';
      }
      return false;
    };
    return [
      ActionCriteria.EventTriggered($d.selection, 'add', callback),
      ActionCriteria.EventTriggered($d.selection, 'remove', callback),
      ActionCriteria.EventTriggered($d.undoManager, 'execute', callback)
    ];
  }

  execute(): void {
    const node = this.context.model.activeDiagram.selection.nodes[0]!;

    UnitOfWork.executeWithUndo(
      this.context.model.activeDiagram,
      `Text decoration: ${this.prop}`,
      uow => {
        node.updateProps(p => {
          p.text ??= {};
          if (p.text.textDecoration === this.prop) {
            p.text.textDecoration = 'none';
          } else {
            p.text.textDecoration = this.prop;
          }
        }, uow);
      }
    );

    this.state = node.renderProps.text.textDecoration === this.prop;
    this.emit('actionChanged');
  }
}

export class TextEditAction extends AbstractSelectionAction<Application> {
  name = $tStr('action.TEXT_EDIT.name', 'Edit...');

  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Node);
  }

  execute(): void {
    const selectedItem = this.context.model.activeDiagram.selection.nodes[0]!;

    // Get the current HTML text content
    const currentHtmlText = selectedItem.texts.text ?? '';

    const def = selectedItem.getDefinition() as ShapeNodeDefinition;
    const textHandler = def.getTextHandler(selectedItem);

    // Convert HTML to edit format for editing
    let structuredText = '';
    try {
      structuredText = currentHtmlText ? textHandler.dialog.storedToEdit(currentHtmlText) : '';
    } catch (_error) {
      structuredText = currentHtmlText;
    }

    this.context.ui.showDialog(
      new StringInputDialogCommand(
        {
          label: 'Text',
          title: 'Edit text',
          description: `Enter text${textHandler.format ? ` using ${textHandler.format} syntax` : ''}. It will be converted to HTML when saved.`,
          value: structuredText,
          saveButtonLabel: 'Save',
          type: 'text'
        },
        (structuredTextInput: string) => {
          // Convert edit format back to HTML for storage
          let htmlOutput = '';
          try {
            htmlOutput = structuredTextInput
              ? textHandler.dialog.editToStored(structuredTextInput)
              : '';
          } catch (_error) {
            htmlOutput = structuredTextInput;
          }

          UnitOfWork.executeWithUndo(selectedItem.diagram, 'Edit text', uow =>
            selectedItem.setText(htmlOutput, uow)
          );
        }
      )
    );
  }
}
