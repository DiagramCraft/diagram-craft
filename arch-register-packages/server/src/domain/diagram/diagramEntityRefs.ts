import type {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedRegularElement
} from '@diagram-craft/model/serialization/serializedTypes';

const collectRefsFromElement = (element: SerializedRegularElement, result: Set<string>) => {
  const entries = element.metadata?.data?.data;
  if (entries) {
    for (const entry of entries) {
      if (entry.type === 'external' && entry.external?.uid) {
        result.add(entry.external.uid);
      }
    }
  }
  if ('children' in element && element.children) {
    for (const child of element.children) {
      collectRefsFromElement(child, result);
    }
  }
};

const collectRefsFromDiagram = (diagram: SerializedDiagram, result: Set<string>) => {
  for (const layer of diagram.layers) {
    if (layer.layerType === 'regular' || layer.layerType === 'basic') {
      for (const element of layer.elements) {
        collectRefsFromElement(element, result);
      }
    }
  }
  for (const child of diagram.diagrams) {
    collectRefsFromDiagram(child, result);
  }
};

export const getDiagramEntityRefs = (document: SerializedDiagramDocument): string[] => {
  const result = new Set<string>();
  for (const diagram of document.diagrams) {
    collectRefsFromDiagram(diagram, result);
  }
  return Array.from(result);
};
