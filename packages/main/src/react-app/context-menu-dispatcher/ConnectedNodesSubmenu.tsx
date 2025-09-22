import * as ContextMenu from '@radix-ui/react-context-menu';
import { TbChevronRight, TbLink, TbLinkOff, TbPentagon } from 'react-icons/tb';
import { useDiagram } from '../../application';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { AnchorEndpoint, ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { Diagram } from '@diagram-craft/model/diagram';
import type { Data } from '@diagram-craft/model/dataProvider';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { decodeDataReferences } from '@diagram-craft/model/diagramDocumentDataSchemas';

type ConnectionItem = {
  id: string;
  name: string;
  type: 'node' | 'data' | 'both';
  node?: DiagramNode;
  data?: Data;
  schemaName?: string;
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
      connectedItems.set(otherNode.id, {
        id: otherNode.id,
        name: otherNode.name,
        type: 'node',
        node: otherNode
      });
    }
  }

  // Find data entries connected via reference fields
  const nodeData = selectedNode.metadata.data?.data;
  if (nodeData && nodeData.length > 0) {
    for (const dataEntry of nodeData) {
      // Get the schema for this data entry
      const schema = diagram.document.data.db.getSchema(dataEntry.schema);
      if (!schema) continue;

      // Check each field in the schema for reference fields
      for (const field of schema.fields) {
        if (field.type === 'reference') {
          // Get the referenced UIDs from the data
          let referencedUIDs: string[] = [];
          if (dataEntry.data && dataEntry.data[field.id]) {
            referencedUIDs = decodeDataReferences(dataEntry.data[field.id] as string);
          }

          // Get the referenced schema
          const referencedSchema = diagram.document.data.db.getSchema(field.schemaId);
          if (!referencedSchema) continue;

          // Find the actual data entries for these UIDs
          const dataProvider = diagram.document.data.db;
          if (!dataProvider) continue;

          const referencedData = dataProvider.getData(referencedSchema);
          if (!referencedData) continue;

          for (const uid of referencedUIDs) {
            // Find the data entry with this UID
            const dataItem = referencedData.find(item => item._uid === uid);
            if (!dataItem) continue;

            // Get display name (use 'name' field if exists, otherwise first field)
            const nameField =
              referencedSchema.fields.find(f => f.name.toLowerCase() === 'name') ??
              referencedSchema.fields[0];
            const displayName = dataItem[nameField?.id] ?? dataItem._uid;

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
              connectedItems.set(associatedNode.id, {
                id: associatedNode.id,
                name: associatedNode.name,
                type: 'both',
                node: associatedNode,
                data: dataItem,
                schemaName: referencedSchema.name
              });
            } else {
              // Add as a data-only entry
              connectedItems.set(uid, {
                id: uid,
                name: displayName,
                type: 'data',
                data: dataItem,
                schemaName: referencedSchema.name
              });
            }
          }
        }
      }
    }
  }

  return Array.from(connectedItems.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const makeDataReference = (item: Data, schemaId: string) => {
  return {
    type: 'external' as const,
    external: { uid: item._uid },
    data: item,
    schema: schemaId,
    enabled: true
  };
};

// Helper function to create a node for a data entry
const createNodeForData = (item: Data, schemaName: string, diagram: Diagram) => {
  const activeLayer = diagram.activeLayer;
  assertRegularLayer(activeLayer);

  // Get the schema to find the first field for text display
  const schema = diagram.document.data.db.findSchemaByName(schemaName);
  if (!schema) return;

  // Get current selection to position new node
  const selectedNode = diagram.selectionState.nodes[0];
  const offsetX = 20; // Position closer to the right of selected node

  // Create the new node
  const newNode = DiagramNode.create(
    newid(),
    'rect',
    {
      w: 100,
      h: 100,
      x: selectedNode.bounds.x + selectedNode.bounds.w + offsetX,
      y: selectedNode.bounds.y,
      r: 0
    },
    activeLayer,
    {},
    { data: { data: [makeDataReference(item, schema.id)] } },
    { text: `%${schema.fields[0]?.id ?? '_uid'}%` }
  );

  // Create an edge connecting the selected node to the new node
  const newEdge = DiagramEdge.create(
    newid(),
    new AnchorEndpoint(selectedNode, 'e'),
    new AnchorEndpoint(newNode, 'w'),
    {},
    {},
    [],
    activeLayer
  );

  // Add both node and edge to the diagram
  const uow = UnitOfWork.immediate(diagram);
  activeLayer.addElement(newNode, uow);
  activeLayer.addElement(newEdge, uow);

  // Apply active styles
  newNode.updateMetadata(meta => {
    meta.style = diagram.document.styles.activeNodeStylesheet.id;
    meta.textStyle = diagram.document.styles.activeTextStylesheet.id;
  }, uow);

  newEdge.updateMetadata(meta => {
    meta.style = diagram.document.styles.activeEdgeStylesheet.id;
  }, uow);

  diagram.undoManager.addAndExecute(
    new ElementAddUndoableAction([newNode, newEdge], diagram, activeLayer)
  );

  diagram.selectionState.setElements([newNode]);
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
            connectedItems.map(item => {
              // Create display name with type indicator
              const displayName =
                item.type === 'data' ? `${item.name} (${item.schemaName})` : item.name;

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
                      {/* Data-specific actions */}
                      {(item.type === 'data' || item.type === 'both') && item.data && (
                        <>
                          <ContextMenu.Item className="cmp-context-menu__item" disabled>
                            Data Entry ({item.schemaName})
                          </ContextMenu.Item>

                          {item.type === 'data' && (
                            <>
                              <ContextMenu.Separator className="cmp-context-menu__separator" />
                              <ContextMenu.Item
                                className="cmp-context-menu__item"
                                onClick={() => {
                                  createNodeForData(item.data!, item.schemaName!, diagram);
                                }}
                              >
                                Create Node
                              </ContextMenu.Item>
                            </>
                          )}
                        </>
                      )}

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
