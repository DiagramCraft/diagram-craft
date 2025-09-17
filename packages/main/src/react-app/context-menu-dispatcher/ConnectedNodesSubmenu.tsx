import * as ContextMenu from '@radix-ui/react-context-menu';
import { TbChevronRight, TbLink, TbLinkOff, TbPentagon } from 'react-icons/tb';
import { useDiagram } from '../../application';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { Diagram } from '@diagram-craft/model/diagram';
import type { Data } from '@diagram-craft/model/dataProvider';

type ConnectionItem = {
  id: string;
  name: string;
  type: 'node' | 'data' | 'both'; // 'both' means node with data
  node?: DiagramNode;
  data?: Data;
  schemaName?: string;
  viaEdges: number;
  viaReferences: string[];
};

// Get connected nodes and data entries for single node selection
const getConnectedItems = (diagram: Diagram): ConnectionItem[] => {
  if (diagram.selectionState.getSelectionType() !== 'single-node') return [];

  const selectedNode = diagram.selectionState.nodes[0];
  const connectedItems = new Map<string, ConnectionItem>();

  // Find nodes connected via edges
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
      const existing = connectedItems.get(`node-${otherNode.id}`);
      connectedItems.set(`node-${otherNode.id}`, {
        id: `node-${otherNode.id}`,
        name: otherNode.name,
        type: 'node',
        node: otherNode,
        viaEdges: (existing?.viaEdges ?? 0) + 1,
        viaReferences: existing?.viaReferences ?? []
      });
    }
  }

  // Find data entries connected via reference fields
  const nodeData = selectedNode.metadata.data?.data;
  if (nodeData && nodeData.length > 0) {
    for (const dataEntry of nodeData) {
      // Get the schema for this data entry
      const schema = diagram.document.data.schemas.get(dataEntry.schema);
      if (!schema) continue;

      // Check each field in the schema for reference fields
      for (const field of schema.fields) {
        if (field.type === 'reference') {
          // Get the referenced UIDs from the data
          let referencedUIDs: string[] = [];
          if (dataEntry.data && dataEntry.data[field.id]) {
            const fieldValue = dataEntry.data[field.id];
            if (typeof fieldValue === 'string') {
              try {
                referencedUIDs = JSON.parse(fieldValue);
              } catch {
                // If parsing fails, skip this field
                continue;
              }
            }
          }

          // Get the referenced schema
          const referencedSchema = diagram.document.data.schemas.get(field.schemaId);
          if (!referencedSchema) continue;

          // Find the actual data entries for these UIDs
          const dataProvider = diagram.document.data.provider;
          if (!dataProvider) continue;

          const referencedData = dataProvider.getData(referencedSchema);
          if (!referencedData) continue;

          for (const uid of referencedUIDs) {
            // Find the data entry with this UID
            const dataItem = referencedData.find(item => item._uid === uid);
            if (!dataItem) continue;

            // Get display name (use 'name' field if exists, otherwise first field)
            const nameField = referencedSchema.fields.find(f => f.name.toLowerCase() === 'name') ?? referencedSchema.fields[0];
            const displayName = dataItem[nameField?.id] || dataItem._uid;

            const referenceName = `${field.name} (${schema.name})`;
            const itemId = `data-${uid}`;

            // Check if there's also a node with this data
            let associatedNode: DiagramNode | undefined;
            for (const element of diagram.allElements()) {
              if (element.type === 'node') {
                const node = element as DiagramNode;
                const nodeDataEntries = node.metadata.data?.data ?? [];
                for (const nodeDataEntry of nodeDataEntries) {
                  if (nodeDataEntry.data && nodeDataEntry.data._uid === uid) {
                    associatedNode = node;
                    break;
                  }
                }
                if (associatedNode) break;
              }
            }

            // If there's an associated node, update the node entry to be 'both' type
            if (associatedNode) {
              const nodeId = `node-${associatedNode.id}`;
              const existing = connectedItems.get(nodeId);
              connectedItems.set(nodeId, {
                id: nodeId,
                name: associatedNode.name,
                type: 'both', // Node with data
                node: associatedNode,
                data: dataItem,
                schemaName: referencedSchema.name,
                viaEdges: existing?.viaEdges ?? 0,
                viaReferences: [...(existing?.viaReferences ?? []), referenceName]
              });
            } else {
              // Add as a data-only entry
              const existing = connectedItems.get(itemId);
              connectedItems.set(itemId, {
                id: itemId,
                name: displayName,
                type: 'data',
                data: dataItem,
                schemaName: referencedSchema.name,
                viaEdges: existing?.viaEdges ?? 0,
                viaReferences: [...(existing?.viaReferences ?? []), referenceName]
              });
            }
          }
        }
      }
    }
  }

  return Array.from(connectedItems.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Helper function to get the appropriate icon for each connection type
const getConnectionIcon = (item: ConnectionItem) => {
  switch (item.type) {
    case 'both':
      return TbLink; // Node with data
    case 'data':
      return TbLinkOff; // Data only, no node
    case 'node':
      return TbPentagon; // Node only, no data
    default:
      return TbPentagon;
  }
};

export const ConnectedNodesSubmenu = () => {
  const diagram = useDiagram();

  const connectedItems = getConnectedItems(diagram);

  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger
        className="cmp-context-menu__sub-trigger"
        disabled={connectedItems.length === 0}
      >
        Connected Items
        <div className="cmp-context-menu__right-slot">
          <TbChevronRight />
        </div>
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
          {connectedItems.length === 0 ? (
            <ContextMenu.Item className="cmp-context-menu__item" disabled>
              No connected items
            </ContextMenu.Item>
          ) : (
            connectedItems.map((item) => {
              // Create display name with type indicator
              const displayName = item.type === 'data'
                ? `${item.name} (${item.schemaName})`
                : item.name;

              // Get the appropriate icon component
              const IconComponent = getConnectionIcon(item);

              return (
                <ContextMenu.Sub key={item.id}>
                  <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <IconComponent style={{ fontSize: '0.9em', color: 'var(--cmp-fg-dim)' }} />
                      <div>{displayName}</div>
                    </div>
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
                      {/* Node-specific actions */}
                      {(item.type === 'node' || item.type === 'both') && item.node && (
                        <>
                          <ContextMenu.Item
                            className="cmp-context-menu__item"
                            onClick={() => {
                              diagram.selectionState.setElements([item.node!]);
                            }}
                          >
                            Select Node
                          </ContextMenu.Item>
                          <ContextMenu.Item
                            className="cmp-context-menu__item"
                            onClick={() => {
                              diagram.selectionState.toggle(item.node!);
                            }}
                          >
                            Add Node to Selection
                          </ContextMenu.Item>
                        </>
                      )}

                      {/* Data-specific actions */}
                      {(item.type === 'data' || item.type === 'both') && item.data && (
                        <>
                          <ContextMenu.Item className="cmp-context-menu__item" disabled>
                            Data Entry ({item.schemaName})
                          </ContextMenu.Item>
                          <ContextMenu.Item className="cmp-context-menu__item" disabled>
                            UID: {item.data._uid}
                          </ContextMenu.Item>
                        </>
                      )}

                      {/* Show connection details */}
                      {(item.viaEdges > 0 || item.viaReferences.length > 0) && (
                        <>
                          <ContextMenu.Separator className="cmp-context-menu__separator" />
                          <ContextMenu.Label className="cmp-context-menu__label">
                            Connected via:
                          </ContextMenu.Label>
                          {item.viaEdges > 0 && (
                            <ContextMenu.Item className="cmp-context-menu__item" disabled>
                              {item.viaEdges} Direct Edge{item.viaEdges !== 1 ? 's' : ''}
                            </ContextMenu.Item>
                          )}
                          {item.viaReferences.map((ref, index) => (
                            <ContextMenu.Item key={index} className="cmp-context-menu__item" disabled>
                              {ref}
                            </ContextMenu.Item>
                          ))}
                        </>
                      )}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
              );
            })
          )}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
};
