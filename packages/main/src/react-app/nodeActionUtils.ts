import type { Application } from '../application';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { DialogCommand } from '@diagram-craft/canvas/context';
import { getNodeActions, type ResolvedNodeAction } from '@diagram-craft/model/nodeActions';
import { fetchWithTimeout } from '@diagram-craft/utils/fetch';

const REST_ACTION_TIMEOUT_MS = 10000;

export const isNodeActionable = (node: DiagramNode) => {
  return getNodeActions(node.renderProps.actions).length > 0;
};

export const executeNodeAction = (
  application: Application,
  action: ResolvedNodeAction,
  node: DiagramNode
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

    case 'rest': {
      const url = action.url;
      if (url === undefined) return;

      const payload = {
        id: node.id,
        type: node.nodeType,
        text: node.getText()
      };

      fetchWithTimeout(url, REST_ACTION_TIMEOUT_MS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => {
          if (!res.ok) {
            console.error(`REST call action failed: ${res.status} ${res.statusText}`);
          }
        })
        .catch(error => {
          console.error('REST call action failed', error);
        });
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

      diagram.undoManager.execute('Toggle layer visibility', uow => {
        diagram.layers.toggleVisibility(layer, uow);
      });
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
