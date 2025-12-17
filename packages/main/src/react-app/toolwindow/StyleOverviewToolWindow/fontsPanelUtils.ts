import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';

export type FontCombination = {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  elements: DiagramNode[];
  count: number;
};

export type FontScope = 'current-diagram' | 'entire-document';
export type FontSortOrder = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc';

const getAllNodesFromDiagram = (diagram: Diagram): DiagramNode[] =>
  diagram.layers.all
    .filter((layer): layer is RegularLayer => layer.type === 'regular')
    .flatMap(layer => Array.from(layer.elements))
    .filter(isNode);

const getAllNodesFromDocument = (document: DiagramDocument): DiagramNode[] =>
  document.diagrams.flatMap(d => getAllNodesFromDiagram(d));

export const collectFonts = (scope: FontScope, diagram: Diagram): Map<string, FontCombination> => {
  const fontMap = new Map<string, FontCombination>();

  const elements =
    scope === 'current-diagram'
      ? getAllNodesFromDiagram(diagram)
      : getAllNodesFromDocument(diagram.document);

  for (const node of elements) {
    const text = node.getText();
    if (!text || text.trim() === '') {
      continue;
    }

    const textProps = node.renderProps.text;
    const fontFamily = textProps?.font ?? 'sans-serif';
    const fontSize = textProps?.fontSize ?? 10;
    const bold = textProps?.bold ?? false;
    const italic = textProps?.italic ?? false;

    const key = `${fontFamily}|${fontSize}|${bold}|${italic}`;

    if (!fontMap.has(key)) {
      fontMap.set(key, {
        fontFamily,
        fontSize,
        bold,
        italic,
        elements: [],
        count: 0
      });
    }

    const combo = fontMap.get(key)!;
    combo.elements.push(node);
    combo.count++;
  }

  return fontMap;
};

export const sortFonts = (
  fonts: FontCombination[],
  sortOrder: FontSortOrder
): FontCombination[] => {
  const sorted = [...fonts];

  switch (sortOrder) {
    case 'count-desc':
      return sorted.sort((a, b) => b.count - a.count);
    case 'count-asc':
      return sorted.sort((a, b) => a.count - b.count);
    case 'alpha-asc':
      return sorted.sort(
        (a, b) => a.fontFamily.localeCompare(b.fontFamily) || a.fontSize - b.fontSize
      );
    case 'alpha-desc':
      return sorted.sort(
        (a, b) => b.fontFamily.localeCompare(a.fontFamily) || b.fontSize - a.fontSize
      );
    default:
      return sorted;
  }
};
