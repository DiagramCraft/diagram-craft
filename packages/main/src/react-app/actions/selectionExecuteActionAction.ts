import { Application } from '../../application';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { isEmptyString } from '@diagram-craft/utils/strings';

declare global {
  namespace DiagramCraft {
    interface ActionMap extends ReturnType<typeof selectionExecuteActionActions> {}
  }
}

export const selectionExecuteActionActions = (context: Application) => ({
  SELECTION_EXECUTE_ACTION: new SelectionExecuteAction(context)
});

export class SelectionExecuteAction extends AbstractSelectionAction<Application, { id?: string }> {
  constructor(context: Application) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Application) {
    return [
      ...super.getCriteria(context),
      ActionCriteria.Simple(() => {
        return context.model.activeDiagram.selection.elements.every(e => {
          return (
            isNode(e) &&
            e.renderProps.action.type !== undefined &&
            e.renderProps.action.type !== 'none' &&
            !isEmptyString(e.renderProps.action.url)
          );
        });
      })
    ];
  }

  execute(arg: { id?: string }): void {
    const document = this.context.model.activeDocument;
    const diagram = this.context.model.activeDiagram;

    let node: DiagramNode;
    if (arg?.id) {
      const n = diagram.nodeLookup.get(arg?.id);
      assert.present(n);

      node = n;
    } else {
      assert.arrayWithExactlyOneElement(diagram.selection.nodes);

      node = diagram.selection.nodes[0];
    }

    switch (node.renderProps.action.type) {
      case 'url':
        window.open(node.renderProps.action.url, '_blank');
        return;

      case 'diagram': {
        const newDiagram = document.byId(node.renderProps.action.url);
        if (newDiagram === undefined) return;

        this.context.model.activeDiagram = newDiagram;
        return;
      }

      case 'layer': {
        const layer = diagram.layers.byId(node.renderProps.action.url);
        if (layer === undefined) return;

        diagram.layers.toggleVisibility(layer);
        return;
      }

      case 'none':
      case undefined:
        // Do nothing
        return;
    }

    // Check exhaustive handling of switch cases
    node.renderProps.action.type satisfies never;
  }
}
