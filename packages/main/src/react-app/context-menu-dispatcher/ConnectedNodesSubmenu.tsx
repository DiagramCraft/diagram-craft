import * as ContextMenu from '@radix-ui/react-context-menu';
import { TbChevronRight } from 'react-icons/tb';
import { useDiagram } from '../../application';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { Diagram } from '@diagram-craft/model/diagram';

// Get connected nodes for single node selection
const getConnectedNodes = (diagram: Diagram) => {
  if (diagram.selectionState.getSelectionType() !== 'single-node') return [];

  const selectedNode = diagram.selectionState.nodes[0];
  const connectedNodes = new Map<string, { node: DiagramNode; viaEdges: number }>();

  for (const edge of selectedNode.edges) {
    // Find the other end of the edge
    let otherNode: DiagramNode | undefined;

    if (edge.start instanceof ConnectedEndpoint && edge.start.node === selectedNode) {
      if (edge.end instanceof ConnectedEndpoint) {
        otherNode = edge.end.node;
      }
    } else if (edge.end instanceof ConnectedEndpoint && edge.end.node === selectedNode) {
      if (edge.start instanceof ConnectedEndpoint) {
        otherNode = edge.start.node;
      }
    }

    if (otherNode && otherNode !== selectedNode) {
      const existing = connectedNodes.get(otherNode.id);
      connectedNodes.set(otherNode.id, {
        node: otherNode,
        viaEdges: (existing?.viaEdges ?? 0) + 1
      });
    }
  }

  return Array.from(connectedNodes.values()).sort((a, b) => a.node.name.localeCompare(b.node.name));
};

export const ConnectedNodesSubmenu = () => {
  const diagram = useDiagram();

  const connectedNodes = getConnectedNodes(diagram);

  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger
        className="cmp-context-menu__sub-trigger"
        disabled={connectedNodes.length === 0}
      >
        Connected Nodes
        <div className="cmp-context-menu__right-slot">
          <TbChevronRight />
        </div>
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
          {connectedNodes.length === 0 ? (
            <ContextMenu.Item className="cmp-context-menu__item" disabled>
              No connected nodes
            </ContextMenu.Item>
          ) : (
            connectedNodes.map(({ node }) => (
              <ContextMenu.Sub key={node.id}>
                <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
                  {node.name}
                  <div className="cmp-context-menu__right-slot">
                    <TbChevronRight />
                  </div>
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent
                    className="cmp-context-menu"
                    sideOffset={2}
                    alignOffset={-5}
                  >
                    <ContextMenu.Item
                      className="cmp-context-menu__item"
                      onClick={() => {
                        diagram.selectionState.setElements([node]);
                      }}
                    >
                      Select Node
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className="cmp-context-menu__item"
                      onClick={() => {
                        diagram.selectionState.toggle(node);
                      }}
                    >
                      Add Node to Selection
                    </ContextMenu.Item>
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
            ))
          )}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
};
