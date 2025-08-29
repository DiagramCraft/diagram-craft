import { DiagramElement } from '@diagram-craft/model/diagramElement';

export const Highlights = {
  NODE__EDGE_CONNECT: 'node__edge-connect',
  NODE__ACTIVE_ANCHOR: 'node__active-anchor',
  NODE__DROP_TARGET: 'node__drop-target',
  NODE__TOOL_EDIT: 'node__tool-edit',
  NODE__TOOL_CONVERT: 'node__tool-convert',
  NODE__HIGHLIGHT: 'node__highlight'
};

const HIGHLIGHT_STORE = new WeakMap<DiagramElement, Highlight>();

const DELIMITER = '---';

const getHighlight = (highlight: string, arg?: string) =>
  arg ? `${highlight}${DELIMITER}${arg}` : highlight;

class Highlight {
  constructor(public highlights: string[]) {}

  static get(element: DiagramElement) {
    if (!HIGHLIGHT_STORE.has(element)) HIGHLIGHT_STORE.set(element, new Highlight([]));
    return HIGHLIGHT_STORE.get(element)!;
  }

  remove(highlight: string, arg?: string) {
    if (arg) {
      this.highlights = this.highlights.filter(h => h !== getHighlight(highlight, arg));
    } else {
      this.highlights = this.highlights.filter(h => !h.startsWith(getHighlight(highlight, '')));
    }
  }

  add(highlight: string, arg?: string) {
    if (arg) {
      this.remove(highlight);
    }
    this.highlights.push(getHighlight(highlight, arg));
  }

  has(highlight: string, arg?: string) {
    return arg
      ? this.highlights.includes(getHighlight(highlight, arg))
      : this.highlights.some(h => h.startsWith(getHighlight(highlight, '')));
  }

  getArg(highlight: string) {
    const s = this.highlights.filter(h => h.startsWith(getHighlight(highlight, '')));
    return s.length === 0 ? undefined : s[0].split(DELIMITER)[1];
  }
}

export const addHighlight = (element: DiagramElement, highlight: string, arg?: string) => {
  Highlight.get(element).add(highlight, arg);
  element.diagram.emitAsync('elementHighlighted', { element });
};

export const removeHighlight = (
  element: DiagramElement | undefined,
  highlight: string,
  arg?: string
) => {
  if (!element) return;

  Highlight.get(element).remove(highlight, arg);
  element.diagram.emitAsync('elementHighlighted', { element });
};

export const hasHighlight = (
  element: DiagramElement | undefined,
  highlight: string,
  arg?: string
) => {
  if (!element) return false;
  if (!HIGHLIGHT_STORE.has(element)) return false;

  return Highlight.get(element).has(highlight, arg);
};

export const getHighlights = (element: DiagramElement | undefined) => {
  if (!element) return [];

  return Highlight.get(element).highlights;
};

export const getHighlightValue = (element: DiagramElement | undefined, highlight: string) => {
  if (!element) return [];

  return Highlight.get(element)!.getArg(highlight);
};
