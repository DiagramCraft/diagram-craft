import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';

/**
 * Helper utilities for managing DOM IDs of diagram elements.
 * These IDs are used to connect SVG/HTML DOM elements with their corresponding diagram model objects.
 */
export const CanvasDomHelper = {
  /**
   * Get the DOM ID for a diagram container element
   */
  diagramId(diagram: Diagram): string {
    return `diagram-${diagram.id}`;
  },

  /**
   * Get the DOM ID for a node element
   */
  nodeId(node: DiagramNode): string {
    return `node-${node.id}`;
  },

  /**
   * Get the DOM ID for an edge element
   */
  edgeId(edge: DiagramEdge): string {
    return `edge-${edge.id}`;
  },

  /**
   * Get the DOM ID for any diagram element (node or edge)
   */
  elementId(element: DiagramElement): string {
    return isNode(element)
      ? CanvasDomHelper.nodeId(element)
      : CanvasDomHelper.edgeId(element as DiagramEdge);
  },

  /**
   * Get the DOM element for a diagram container
   */
  diagramElement(diagram: Diagram): HTMLElement | null {
    return document.getElementById(CanvasDomHelper.diagramId(diagram));
  },

  /**
   * Get the DOM element for a node
   */
  nodeElement(node: DiagramNode): HTMLElement | null {
    return document.getElementById(CanvasDomHelper.nodeId(node));
  },

  /**
   * Get the DOM element for an edge
   */
  edgeElement(edge: DiagramEdge): HTMLElement | null {
    return document.getElementById(CanvasDomHelper.edgeId(edge));
  },

  /**
   * Get the DOM element for any diagram element (node or edge)
   */
  elementElement(element: DiagramElement): HTMLElement | null {
    return document.getElementById(CanvasDomHelper.elementId(element));
  }
};
