import type { Diagram } from '@diagram-craft/model/diagram';
import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import type { DiagramNode, NodePropsForEditing } from '@diagram-craft/model/diagramNode';
import type { EdgePropsForEditing, ResolvedLabelNode } from '@diagram-craft/model/diagramEdge';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { AnchorEndpoint, ConnectedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deepMerge, isNonNullObj } from '@diagram-craft/utils/object';
import { type ParsedElement } from './types';
import { collectElementIds } from './utils';
import { placeNode } from '@diagram-craft/canvas/utils/placeNode';
import type { EdgeProps, ElementMetadata, NodeProps } from '@diagram-craft/model/diagramProps';

// Parsed text only includes explicitly serialized values, while the live model also
// contains defaults and derived state. This checks whether applying the parsed fragment
// would actually change the current value.
const isPartialMatch = (current: unknown, parsed: unknown): boolean => {
  if (Array.isArray(parsed)) {
    // Arrays are compared positionally because parsed edge/node fragments
    // should only be treated as unchanged when the full serialized array matches.
    if (!Array.isArray(current) || current.length !== parsed.length) return false;

    return parsed.every((value, index) => isPartialMatch(current[index], value));
  }

  if (isNonNullObj(parsed)) {
    // Objects are treated as partial patches: every parsed key must already
    // match in the live value, but extra keys in the live model are allowed.
    if (!isNonNullObj(current)) return false;

    for (const [key, value] of Object.entries(parsed)) {
      if (!isPartialMatch(current[key], value)) {
        return false;
      }
    }

    return true;
  }

  return current === parsed;
};

/**
 * Update or create a label node for an edge
 */
const updateOrCreateLabelNode = (
  edge: DiagramElement,
  labelText: string,
  uow: UnitOfWork,
  layer: RegularLayer
): DiagramNode => {
  if (!isEdge(edge)) {
    throw new Error('Element is not an edge');
  }

  // Check if there's already a single label node
  if (edge.labelNodes.length === 1) {
    const labelNode = edge.labelNodes[0]!.node();
    if (labelNode.getText() !== labelText) {
      labelNode.setText(labelText, uow);
    }
    return labelNode;
  }

  // Need to create a new label node or handle multiple label nodes
  // If there are multiple label nodes, we'll remove them all and create a single one
  if (edge.labelNodes.length > 1) {
    // TODO: Move this logic into setLabelNodes
    // Remove all existing label nodes
    for (const ln of edge.labelNodes) {
      const node = ln.node();
      if (layer.elements.includes(node)) {
        layer.removeElement(node, uow);
      } else if (edge.children.includes(node)) {
        edge.removeChild(node, uow);
      }
    }
    edge.setLabelNodes([], uow);
  }

  // Create a new label node
  const labelNode = ElementFactory.node({
    nodeType: 'text',
    bounds: edge.bounds,
    layer,
    texts: { text: labelText }
  });

  layer.addElement(labelNode, uow);

  const labelNodeData: ResolvedLabelNode = {
    id: labelNode.id,
    node: () => labelNode,
    type: 'perpendicular',
    offsetType: 'absolute',
    offset: { x: 0, y: 0 },
    timeOffset: 0.5
  };

  edge.addLabelNode(labelNodeData, uow);

  return labelNode;
};

export const textToDiagram = (elements: ParsedElement[], diagram: Diagram) => {
  const layer = diagram.activeLayer;
  assertRegularLayer(layer);

  UnitOfWork.executeWithUndo(diagram, 'Update diagram', uow => {
    // Collect all parsed element IDs
    const parsedIds = collectElementIds(elements);

    // Collect existing element IDs in the active layer
    const existingIds = new Set<string>();
    const existingElements = new Map<string, DiagramElement>();
    for (const element of layer.elements) {
      existingIds.add(element.id);
      existingElements.set(element.id, element);
    }

    // Track elements to be removed
    const elementsToRemove: DiagramElement[] = [];

    // Track last created/processed node for smart placement
    let lastReferenceNode: DiagramNode | undefined;

    // Process removals (elements in diagram but not in parsed data)
    for (const id of existingIds) {
      if (!parsedIds.has(id)) {
        const element = existingElements.get(id)!;
        element.layer.removeElement(element, uow);
        elementsToRemove.push(element);
      }
    }

    // Process updates and additions
    const processElement = (parsedElement: ParsedElement): DiagramElement | undefined => {
      const existingElement = diagram.lookup(parsedElement.id);

      if (existingElement) {
        // Update existing element
        if (parsedElement.type === 'node' && isNode(existingElement)) {
          // Update text
          if (parsedElement.name !== undefined && existingElement.getText() !== parsedElement.name) {
            existingElement.setText(parsedElement.name, uow);
          }

          // Update props
          if (
            parsedElement.props &&
            !isPartialMatch(existingElement.storedProps, parsedElement.props as Partial<NodeProps>)
          ) {
            existingElement.updateProps(props => {
              deepMerge(props, parsedElement.props as Partial<NodeProps>);
            }, uow);
          }

          // Update metadata
          if (
            parsedElement.metadata &&
            !isPartialMatch(existingElement.metadata, parsedElement.metadata)
          ) {
            existingElement.updateMetadata(metadata => {
              Object.assign(metadata, parsedElement.metadata);
            }, uow);
          }

          // Update stylesheets
          if (parsedElement.stylesheet && existingElement.metadata.style !== parsedElement.stylesheet) {
            existingElement.updateMetadata(metadata => {
              metadata.style = parsedElement.stylesheet!;
            }, uow);
          }
          if (
            parsedElement.textStylesheet &&
            existingElement.metadata.textStyle !== parsedElement.textStylesheet
          ) {
            existingElement.updateMetadata(metadata => {
              metadata.textStyle = parsedElement.textStylesheet!;
            }, uow);
          }

          // Update reference for next node placement
          if (existingElement.parent === undefined) {
            lastReferenceNode = existingElement;
          }

          // Process children
          if (parsedElement.children) {
            for (const child of parsedElement.children) {
              processElement(child);
            }
          }
        } else if (parsedElement.type === 'edge' && isEdge(existingElement)) {
          // Update edge props
          if (
            parsedElement.props &&
            !isPartialMatch(existingElement.storedProps, parsedElement.props as Partial<EdgeProps>)
          ) {
            existingElement.updateProps(props => {
              deepMerge(props, parsedElement.props as Partial<EdgeProps>);
            }, uow);
          }

          // Update metadata
          if (
            parsedElement.metadata &&
            !isPartialMatch(existingElement.metadata, parsedElement.metadata)
          ) {
            existingElement.updateMetadata(metadata => {
              Object.assign(metadata, parsedElement.metadata);
            }, uow);
          }

          // Update stylesheet
          if (parsedElement.stylesheet && existingElement.metadata.style !== parsedElement.stylesheet) {
            existingElement.updateMetadata(metadata => {
              metadata.style = parsedElement.stylesheet!;
            }, uow);
          }

          // Update connections (from/to)
          if (parsedElement.from !== undefined || parsedElement.to !== undefined) {
            if (parsedElement.from) {
              const fromNode = diagram.lookup(parsedElement.from);
              const currentFromId = existingElement.start instanceof ConnectedEndpoint
                ? existingElement.start.node.id
                : undefined;
              if (fromNode && isNode(fromNode) && currentFromId !== parsedElement.from) {
                existingElement.setStart(new AnchorEndpoint(fromNode, 'c'), uow);
              }
            }
            if (parsedElement.to) {
              const toNode = diagram.lookup(parsedElement.to);
              const currentToId = existingElement.end instanceof ConnectedEndpoint
                ? existingElement.end.node.id
                : undefined;
              if (toNode && isNode(toNode) && currentToId !== parsedElement.to) {
                existingElement.setEnd(new AnchorEndpoint(toNode, 'c'), uow);
              }
            }
          }

          // Update label node if present
          if (parsedElement.label !== undefined) {
            updateOrCreateLabelNode(existingElement, parsedElement.label, uow, layer);
          } else if (existingElement.labelNodes.length > 0) {
            // If no label is specified but edge has label nodes, remove them
            for (const ln of existingElement.labelNodes) {
              const node = ln.node();
              layer.removeElement(node, uow);
            }
            existingElement.setLabelNodes([], uow);
          }
        }
        return existingElement;
      } else {
        // Add new element
        let newElement: DiagramElement | undefined;

        if (parsedElement.type === 'node') {
          // Determine initial bounds for the new node
          let bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

          if (lastReferenceNode) {
            // Use placeNode to find a suitable position relative to the previous node
            bounds = placeNode(bounds, lastReferenceNode, diagram, {
              considerAllLayers: false
            });
          } else {
            // First node: place at diagram center
            const centerX = diagram.bounds.x + diagram.bounds.w / 2;
            const centerY = diagram.bounds.y + diagram.bounds.h / 2;
            bounds = { x: centerX - 50, y: centerY - 50, w: 100, h: 100, r: 0 };
          }

          const props: NodePropsForEditing = {};
          const metadata: ElementMetadata = {};

          if (parsedElement.props) Object.assign(props, parsedElement.props);
          if (parsedElement.metadata) Object.assign(metadata, parsedElement.metadata);

          // Apply stylesheets
          if (parsedElement.stylesheet) {
            metadata.style = parsedElement.stylesheet;
          }
          if (parsedElement.textStylesheet) {
            metadata.textStyle = parsedElement.textStylesheet;
          }

          newElement = ElementFactory.node({
            id: parsedElement.id,
            nodeType: parsedElement.shape,
            bounds,
            layer,
            props,
            metadata,
            texts: { text: parsedElement.name ?? '' }
          });

          layer.addElement(newElement, uow);

          // Update reference for next node placement
          if (isNode(newElement)) {
            lastReferenceNode = newElement;
          }

          // Process children
          if (parsedElement.children) {
            for (const child of parsedElement.children) {
              processElement(child);
            }
          }
        } else if (parsedElement.type === 'edge') {
          // Create new edge
          const props: EdgePropsForEditing = {};
          const metadata: ElementMetadata = {};

          // Apply props
          if (parsedElement.props) {
            Object.assign(props, parsedElement.props);
          }

          // Apply metadata
          if (parsedElement.metadata) {
            Object.assign(metadata, parsedElement.metadata);
          }

          // Apply stylesheet
          if (parsedElement.stylesheet) {
            metadata.style = parsedElement.stylesheet;
          }

          // Determine endpoints
          let start: FreeEndpoint | AnchorEndpoint;
          let end: FreeEndpoint | AnchorEndpoint;

          if (parsedElement.from) {
            const fromNode = diagram.lookup(parsedElement.from);
            start =
              fromNode && isNode(fromNode)
                ? new AnchorEndpoint(fromNode, 'c')
                : new FreeEndpoint({ x: 0, y: 0 });
          } else {
            start = new FreeEndpoint({ x: 100, y: 100 });
          }

          if (parsedElement.to) {
            const toNode = diagram.lookup(parsedElement.to);
            end =
              toNode && isNode(toNode)
                ? new AnchorEndpoint(toNode, 'c')
                : new FreeEndpoint({ x: 200, y: 200 });
          } else {
            end = new FreeEndpoint({ x: 200, y: 200 });
          }

          newElement = ElementFactory.edge({
            id: parsedElement.id,
            start,
            end,
            props,
            metadata,
            layer
          });

          layer.addElement(newElement, uow);

          // Create label node if label text is provided
          if (parsedElement.label && isEdge(newElement)) {
            updateOrCreateLabelNode(newElement, parsedElement.label, uow, layer);
          }
        }

        return newElement;
      }
    };

    // Process all top-level elements
    for (const element of elements) {
      processElement(element);
    }

    // Update selection to remove any elements that were removed
    if (elementsToRemove.length > 0) {
      const removedIds = new Set(elementsToRemove.map(e => e.id));
      const currentSelection = diagram.selection.elements;
      const updatedSelection = currentSelection.filter(e => !removedIds.has(e.id));

      if (updatedSelection.length !== currentSelection.length) {
        diagram.selection.setElements(updatedSelection);
      }
    }
  });
};

export const _test = {
  updateOrCreateLabelNode
};
