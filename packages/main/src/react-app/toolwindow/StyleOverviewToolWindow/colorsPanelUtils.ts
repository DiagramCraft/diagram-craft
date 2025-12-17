import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';

export type ColorUsage = {
  background: DiagramElement[];
  text: DiagramElement[];
  border: DiagramElement[];
};

export type ColorCombination = {
  color: string;
  rawColor: string;
  usage: ColorUsage;
  totalCount: number;
  backgroundCount: number;
  textCount: number;
  borderCount: number;
};

export type ColorScope = 'current-diagram' | 'entire-document';
export type ColorSortOrder = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc';
export type ColorFilter = 'all' | 'background' | 'text' | 'border';

const resolveCSSVariable = (color: string | undefined): string => {
  if (!color || !color.startsWith('var(')) {
    return color || '';
  }

  const varNameMatch = color.match(/var\((--[^,)]+)/);
  if (!varNameMatch || !varNameMatch[1]) {
    return color;
  }

  const varName: string = varNameMatch[1];
  const appElement = document.getElementById('app');
  if (!appElement) {
    return color;
  }

  const resolvedValue = getComputedStyle(appElement).getPropertyValue(varName).trim();
  return resolvedValue || color;
};

const getAllElementsFromDiagram = (diagram: Diagram): DiagramElement[] =>
  diagram.layers.all
    .filter((layer): layer is RegularLayer => layer.type === 'regular')
    .flatMap(layer => Array.from(layer.elements));

const getAllElementsFromDocument = (document: DiagramDocument): DiagramElement[] =>
  document.diagrams.flatMap(d => getAllElementsFromDiagram(d));

const addColorUsage = (
  map: Map<string, ColorCombination>,
  resolvedColor: string,
  rawColor: string | undefined,
  element: DiagramElement,
  usageType: 'background' | 'text' | 'border'
) => {
  if (!map.has(resolvedColor)) {
    map.set(resolvedColor, {
      color: resolvedColor,
      rawColor: rawColor ?? resolvedColor,
      usage: { background: [], text: [], border: [] },
      totalCount: 0,
      backgroundCount: 0,
      textCount: 0,
      borderCount: 0
    });
  }

  const combo = map.get(resolvedColor)!;
  combo.usage[usageType].push(element);
  combo[`${usageType}Count`]++;
  combo.totalCount++;
};

export const collectColors = (scope: ColorScope, diagram: Diagram): Map<string, ColorCombination> => {
  const colorMap = new Map<string, ColorCombination>();

  const elements =
    scope === 'current-diagram'
      ? getAllElementsFromDiagram(diagram)
      : getAllElementsFromDocument(diagram.document);

  for (const element of elements) {
    if (isNode(element)) {
      const rawBgColor = element.renderProps.fill.color;
      const resolvedBgColor = resolveCSSVariable(rawBgColor);
      if (resolvedBgColor) {
        addColorUsage(colorMap, resolvedBgColor, rawBgColor, element, 'background');
      }

      const rawTextColor = element.renderProps.text?.color;
      if (rawTextColor) {
        const resolvedTextColor = resolveCSSVariable(rawTextColor);
        if (resolvedTextColor) {
          addColorUsage(colorMap, resolvedTextColor, rawTextColor, element, 'text');
        }
      }

      const rawStrokeColor = element.renderProps.stroke.color;
      const resolvedStrokeColor = resolveCSSVariable(rawStrokeColor);
      if (resolvedStrokeColor) {
        addColorUsage(colorMap, resolvedStrokeColor, rawStrokeColor, element, 'border');
      }
    } else {
      const rawStrokeColor = element.renderProps.stroke.color;
      const resolvedStrokeColor = resolveCSSVariable(rawStrokeColor);
      if (resolvedStrokeColor) {
        addColorUsage(colorMap, resolvedStrokeColor, rawStrokeColor, element, 'border');
      }
    }
  }

  return colorMap;
};

export const filterColors = (
  colors: ColorCombination[],
  filter: ColorFilter
): ColorCombination[] => {
  if (filter === 'all') {
    return colors;
  }

  return colors.filter(combo => combo[`${filter}Count`] > 0);
};

export const sortColors = (
  colors: ColorCombination[],
  sortOrder: ColorSortOrder
): ColorCombination[] => {
  const sorted = [...colors];

  switch (sortOrder) {
    case 'count-desc':
      return sorted.sort((a, b) => b.totalCount - a.totalCount);
    case 'count-asc':
      return sorted.sort((a, b) => a.totalCount - b.totalCount);
    case 'alpha-asc':
      return sorted.sort((a, b) => a.color.localeCompare(b.color));
    case 'alpha-desc':
      return sorted.sort((a, b) => b.color.localeCompare(a.color));
    default:
      return sorted;
  }
};
