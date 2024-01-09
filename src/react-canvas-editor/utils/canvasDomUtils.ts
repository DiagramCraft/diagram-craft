type ElementResult = {
  id: string;
  type: 'edge' | 'node';
};

/**
 * Find closest element (node or edge or undefined) to the given (child) node
 */
export const getAncestorDiagramElement = (
  e: SVGElement | HTMLElement
): ElementResult | undefined => {
  let element: SVGElement | HTMLElement | null = e;
  while (element) {
    if (element.id.startsWith('node-')) {
      return {
        id: element.id.slice('node-'.length),
        type: 'node'
      };
    } else if (element.id.startsWith('edge-')) {
      return {
        id: element.id.slice('edge-'.length),
        type: 'edge'
      };
    }
    element = element.parentElement;
  }
  return undefined;
};
