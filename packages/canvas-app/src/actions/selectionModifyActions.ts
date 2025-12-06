import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { getConnectedComponent } from '@diagram-craft/graph/connectivity';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionModifyActions> {}
  }
}

export const selectionModifyActions = (context: ActionContext) => ({
  SELECTION_SELECT_CONNECTED: new SelectionSelectConnectedAction(context),
  SELECTION_SELECT_GROW: new SelectionSelectGrowAction(context),
  SELECTION_SELECT_SHRINK: new SelectionSelectShrinkAction(context)
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

export class SelectionSelectGrowAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Both);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    const elements = new Set(selection.elements);

    for (const element of selection.elements) {
      if (isNode(element)) {
        // Add all outgoing edges for this node
        for (const edge of element.edges) {
          elements.add(edge);
        }
      } else if (isEdge(element)) {
        // Add both connected nodes for this edge
        if (element.start instanceof ConnectedEndpoint) {
          elements.add(element.start.node);
        }
        if (element.end instanceof ConnectedEndpoint) {
          elements.add(element.end.node);
        }
      }
    }

    selection.setElements(Array.from(elements));
    this.emit('actionTriggered', {});
  }
}

export class SelectionSelectShrinkAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Both);
  }

  private countConnectedElements(element: DiagramElement, elementSet: Set<DiagramElement>): number {
    let connectedCount = 0;

    if (isNode(element)) {
      // Count how many edges in the selection connect to this node
      for (const edge of element.edges) {
        if (elementSet.has(edge)) {
          connectedCount++;
        }
      }
    } else if (isEdge(element)) {
      // Count how many connected nodes are in the selection
      if (element.start instanceof ConnectedEndpoint && elementSet.has(element.start.node)) {
        connectedCount++;
      }
      if (element.end instanceof ConnectedEndpoint && elementSet.has(element.end.node)) {
        connectedCount++;
      }
    }

    return connectedCount;
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    const elementSet = new Set(selection.elements);
    const toRemove = new Set<DiagramElement>();

    // Phase 1: Remove elements not connected to any other element in the selection
    for (const element of elementSet) {
      if (this.countConnectedElements(element, elementSet) === 0) {
        toRemove.add(element);
      }
    }

    // If Phase 1 found nothing to remove, try Phase 2
    if (toRemove.size === 0) {
      for (const element of elementSet) {
        if (this.countConnectedElements(element, elementSet) === 1) {
          toRemove.add(element);
        }
      }
    }

    // Remove the identified elements
    for (const element of toRemove) {
      elementSet.delete(element);
    }

    selection.setElements(Array.from(elementSet));
    this.emit('actionTriggered', {});
  }
}
