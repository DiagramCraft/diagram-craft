import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { getConnectedComponent } from '@diagram-craft/graph/connectivity';
import { isNode } from '@diagram-craft/model/diagramElement';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionModifyActions> {}
  }
}

export const selectionModifyActions = (context: ActionContext) => ({
  SELECTION_SELECT_CONNECTED: new SelectionSelectConnectedAction(context)
});

export class SelectionSelectConnectedAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Both);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    const elements = new Set(selection.elements);
    for (const element of selection.elements) {
      // TODO: Handle edges as well
      if (isNode(element)) {
        const component = getConnectedComponent(graph, element.id);
        for (const node of component?.vertices ?? []) {
          elements.add(node.data);
        }
        for (const edge of component?.edges ?? []) {
          elements.add(edge.data);
        }
      }
    }

    selection.setElements(Array.from(elements));
    this.emit('actionTriggered', {});
  }
}
