import { DiagramElement } from '@diagram-craft/model/diagramElement';

export const Highlights = {
  NODE__EDGE_CONNECT: 'node__edge-connect',
  NODE__ACTIVE_ANCHOR: 'node__active-anchor',
  NODE__DROP_TARGET: 'node__drop-target',
  NODE__TOOL_EDIT: 'node__tool-edit',
  NODE__TOOL_CONVERT: 'node__tool-convert'
};

// TODO: Maybe we can change DiagramElement.highlights to be a Set
//       However, we need a set that can trigger events

const DELIMITER = '---';

const getHighlight = (highlight: string, arg?: string) =>
  arg ? `${highlight}${DELIMITER}${arg}` : highlight;

class Highlight {
  constructor(public highlights: string[]) {}

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
  const h = new Highlight([...element.highlights]);
  h.add(highlight, arg);
  element.highlights = h.highlights;
};

export const removeHighlight = (
  element: DiagramElement | undefined,
  highlight: string,
  arg?: string
) => {
  if (!element) return;

  const h = new Highlight([...element.highlights]);
  h.remove(highlight, arg);
  element.highlights = h.highlights;
};

export const hasHighlight = (
  element: DiagramElement | undefined,
  highlight: string,
  arg?: string
) => {
  if (!element) return false;

  const h = new Highlight([...element.highlights]);
  return h.has(highlight, arg);
};

export const getHighlights = (element: DiagramElement | undefined) => {
  if (!element) return [];
  return element.highlights;
};

export const getHighlightValue = (element: DiagramElement | undefined, highlight: string) => {
  if (!element) return [];

  const h = new Highlight([...element.highlights]);
  return h.getArg(highlight);
};
