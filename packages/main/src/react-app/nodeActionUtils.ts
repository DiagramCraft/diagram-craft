import type { Application } from '../application';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { DialogCommand } from '@diagram-craft/canvas/context';
import {
  getExecutableNodeActions,
  type ResolvedNodeAction
} from '@diagram-craft/model/nodeActions';

export const getExecutableActionsForNode = (node: DiagramNode) => {
  return getExecutableNodeActions(node.renderProps.actions);
};

export const isNodeActionable = (node: DiagramNode) => {
  return getExecutableActionsForNode(node).length > 0;
};

export const executeNodeAction = (
  application: Application,
  action: ResolvedNodeAction
) => {
  const document = application.model.activeDocument;
  const diagram = application.model.activeDiagram;

  switch (action.type) {
    case 'url': {
      const url = action.url;
      if (url === undefined) return;

      window.open(url, '_blank');
      return;
    }

    case 'diagram': {
      const targetDiagramId = action.url;
      if (targetDiagramId === undefined) return;

      const newDiagram = document.byId(targetDiagramId);
      if (newDiagram === undefined) return;

      application.model.activeDiagram = newDiagram;
      return;
    }

    case 'layer': {
      const targetLayerId = action.url;
      if (targetLayerId === undefined) return;

      const layer = diagram.layers.byId(targetLayerId);
      if (layer === undefined) return;

      diagram.layers.toggleVisibility(layer);
      return;
    }

    case 'none':
      return;
  }
};

export type NodeActionChooserProps = {
  title: string;
  actions: ResolvedNodeAction[];
};

export const createNodeActionChooserDialog = (
  props: NodeActionChooserProps,
  onOk: (data: ResolvedNodeAction) => void,
  onCancel?: () => void
): DialogCommand<NodeActionChooserProps, ResolvedNodeAction> => ({
  id: 'nodeActionChooser',
  props,
  onOk,
  onCancel
});
