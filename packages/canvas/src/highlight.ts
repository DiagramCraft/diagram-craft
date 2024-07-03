import { DiagramElement } from '@diagram-craft/model/diagramElement';

// TODO: Maybe we can change DiagramElement.highlights to be a Set
//       However, we need a set that can trigger events

export const addHighlight = (element: DiagramElement, highlight: string) => {
  if (hasHighlight(element, highlight)) return;
  element.highlights = [...element.highlights, highlight];
};

export const removeHighlight = (element: DiagramElement | undefined, highlight: string) => {
  if (!element) return;
  element.highlights = element.highlights.filter(h => h !== highlight);
};

export const hasHighlight = (element: DiagramElement, highlight: string) => {
  return element.highlights.includes(highlight);
};

export const getHighlights = (element: DiagramElement | undefined) => {
  if (!element) return [];
  return element.highlights;
};
