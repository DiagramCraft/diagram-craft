import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { getConnectedComponent, getConnectedComponents } from '@diagram-craft/graph/connectivity';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import { extractMaximalTree } from '@diagram-craft/graph/transformation';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionModifyActions> {}
  }
}

export const selectionModifyActions = (context: ActionContext) => ({
  SELECTION_SELECT_CONNECTED: new SelectionSelectConnectedAction(context),
  SELECTION_SELECT_TREE: new SelectionSelectTreeAction(context),
  SELECTION_SELECT_GROW: new SelectionSelectGrowAction(context),
  SELECTION_SELECT_SHRINK: new SelectionSelectShrinkAction(context)
});

export class SelectionSelectConnectedAction extends AbstractSelectionAction {
  name = $tStr('action.SELECTION_SELECT_CONNECTED.name', 'Select Connected');

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

export class SelectionSelectTreeAction extends AbstractSelectionAction {
  name = $tStr('action.SELECTION_SELECT_TREE.name', 'Select Tree');

  constructor(context: ActionContext) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    const elements = new Set<DiagramElement>();

    for (const element of selection.elements) {
      if (isNode(element)) {
        const tree = extractMaximalTree(graph, element.id);
        if (tree) {
          for (const node of tree.vertices) {
            elements.add(node.data);
          }
          for (const edge of tree.edges) {
            elements.add(edge.data);
          }
        }
      }
    }

    selection.setElements(Array.from(elements));
    this.emit('actionTriggered', {});
  }
}

export class SelectionSelectGrowAction extends AbstractSelectionAction {
  name = $tStr('action.SELECTION_SELECT_GROW.name', 'Grow');

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
  name = $tStr('action.SELECTION_SELECT_SHRINK.name', 'Shrink');

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

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    let elementSet = new Set(selection.elements);
    if (elementSet.size === 0) return;

    // Helper to get connected components for a set of elements
    const getComponents = (elements: Set<DiagramElement>) => {
      const nodeIds = new Set([...elements].filter(isNode).map(n => n.id));
      return getConnectedComponents(graph, nodeIds);
    };

    const initialComponents = getComponents(elementSet);

    // Try progressively higher connection counts
    for (let targetCount = 0; targetCount < elementSet.size; targetCount++) {
      const toRemove = new Set<DiagramElement>();

      // Find elements with exactly targetCount connections
      for (const element of elementSet) {
        if (this.countConnectedElements(element, elementSet) === targetCount) {
          toRemove.add(element);
        }
      }

      if (toRemove.size === 0) continue;

      // Create a test set without the elements we want to remove
      const testSet = new Set(elementSet);
      for (const element of toRemove) {
        testSet.delete(element);
      }

      // Check if removing these elements would eliminate any connected component
      const testComponents = getComponents(testSet);

      // If we would lose a connected component, stop shrinking
      if (testComponents.length < initialComponents.length) {
        break;
      }

      // Safe to remove - update elementSet and continue
      elementSet = testSet;
      break;
    }

    selection.setElements(Array.from(elementSet));
    this.emit('actionTriggered', {});
  }
}
