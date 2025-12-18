import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

export type ColorInfo = {
  color: string;
  rawColor: string;
  elements: DiagramElement[];
  count: number;
  isDirty: boolean;
};

export type ColorsByType = {
  backgrounds: ColorInfo[];
  text: ColorInfo[];
  borders: ColorInfo[];
};

export type StylesheetGroup = {
  stylesheetId: string | null;
  stylesheetName: string;
  stylesheetType: 'node' | 'edge' | 'text' | null;
  colors: ColorsByType;
  totalElements: number;
};

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

const checkColorDirty = (
  element: DiagramElement,
  stylesheetProps: Record<string, unknown> | undefined,
  usageType: 'background' | 'text' | 'border'
): boolean => {
  if (!stylesheetProps) return false;

  if (usageType === 'background' && isNode(element)) {
    const nodeColor = element.renderProps.fill.color;
    const stylesheetColor = (stylesheetProps.fill as { color?: string })?.color;
    return stylesheetColor !== undefined && nodeColor !== stylesheetColor;
  }

  if (usageType === 'text' && isNode(element)) {
    const nodeColor = element.renderProps.text?.color;
    const stylesheetColor = (stylesheetProps.text as { color?: string })?.color;
    return stylesheetColor !== undefined && nodeColor !== stylesheetColor;
  }

  if (usageType === 'border') {
    const nodeColor = element.renderProps.stroke.color;
    const stylesheetColor = (stylesheetProps.stroke as { color?: string })?.color;
    return stylesheetColor !== undefined && nodeColor !== stylesheetColor;
  }

  return false;
};

const addColorUsage = (
  colorMap: Map<string, ColorInfo & { anyDirty: boolean }>,
  resolvedColor: string,
  rawColor: string | undefined,
  element: DiagramElement,
  isDirty: boolean
) => {
  if (!colorMap.has(resolvedColor)) {
    colorMap.set(resolvedColor, {
      color: resolvedColor,
      rawColor: rawColor ?? resolvedColor,
      elements: [],
      count: 0,
      isDirty: false,
      anyDirty: false
    });
  }

  const info = colorMap.get(resolvedColor)!;
  info.elements.push(element);
  info.count++;
  if (isDirty) {
    info.anyDirty = true;
  }
};

export const collectColors = (diagram: Diagram, selectedElements?: DiagramElement[]): StylesheetGroup[] => {
  // Map of stylesheet ID to color maps by type
  const groupMap = new Map<string | null, {
    stylesheetName: string;
    stylesheetType: 'node' | 'edge' | 'text' | null;
    backgrounds: Map<string, ColorInfo & { anyDirty: boolean }>;
    text: Map<string, ColorInfo & { anyDirty: boolean }>;
    borders: Map<string, ColorInfo & { anyDirty: boolean }>;
  }>();

  // Use selected elements if provided, otherwise all elements from diagram
  const elements = selectedElements && selectedElements.length > 0
    ? selectedElements
    : getAllElementsFromDiagram(diagram);

  for (const element of elements) {
    // Get stylesheet info for background and borders
    const stylesheetId = element.metadata.style ?? null;
    const stylesheet = stylesheetId
      ? diagram.document.styles.get(stylesheetId)
      : undefined;
    const stylesheetName = stylesheet?.name ?? 'No stylesheet';

    // Initialize group if needed
    if (!groupMap.has(stylesheetId)) {
      groupMap.set(stylesheetId, {
        stylesheetName,
        stylesheetType: stylesheet?.type ?? null,
        backgrounds: new Map(),
        text: new Map(),
        borders: new Map()
      });
    }

    const group = groupMap.get(stylesheetId)!;

    if (isNode(element)) {
      // Collect background colors
      const rawBgColor = element.renderProps.fill.color;
      const resolvedBgColor = resolveCSSVariable(rawBgColor);
      if (resolvedBgColor) {
        const isDirty = stylesheet
          ? checkColorDirty(element, stylesheet.props as Record<string, unknown>, 'background')
          : false;
        addColorUsage(group.backgrounds, resolvedBgColor, rawBgColor, element, isDirty);
      }

      // For text colors, use textStyle stylesheet
      const rawTextColor = element.renderProps.text?.color;
      if (rawTextColor) {
        const textStylesheetId = element.metadata.textStyle ?? null;
        const textStylesheet = textStylesheetId
          ? diagram.document.styles.getTextStyle(textStylesheetId)
          : undefined;
        const textStylesheetName = textStylesheet?.name ?? 'No stylesheet';

        // Initialize text stylesheet group if needed
        if (!groupMap.has(textStylesheetId)) {
          groupMap.set(textStylesheetId, {
            stylesheetName: textStylesheetName,
            stylesheetType: textStylesheet?.type ?? null,
            backgrounds: new Map(),
            text: new Map(),
            borders: new Map()
          });
        }

        const textGroup = groupMap.get(textStylesheetId)!;
        const resolvedTextColor = resolveCSSVariable(rawTextColor);
        if (resolvedTextColor) {
          const isDirty = textStylesheet
            ? checkColorDirty(element, textStylesheet.props as Record<string, unknown>, 'text')
            : false;
          addColorUsage(textGroup.text, resolvedTextColor, rawTextColor, element, isDirty);
        }
      }

      // Collect border colors
      const rawStrokeColor = element.renderProps.stroke.color;
      const resolvedStrokeColor = resolveCSSVariable(rawStrokeColor);
      if (resolvedStrokeColor) {
        const isDirty = stylesheet
          ? checkColorDirty(element, stylesheet.props as Record<string, unknown>, 'border')
          : false;
        addColorUsage(group.borders, resolvedStrokeColor, rawStrokeColor, element, isDirty);
      }
    } else {
      // Edges only have border colors
      const rawStrokeColor = element.renderProps.stroke.color;
      const resolvedStrokeColor = resolveCSSVariable(rawStrokeColor);
      if (resolvedStrokeColor) {
        const isDirty = stylesheet
          ? checkColorDirty(element, stylesheet.props as Record<string, unknown>, 'border')
          : false;
        addColorUsage(group.borders, resolvedStrokeColor, rawStrokeColor, element, isDirty);
      }
    }
  }

  // Convert to final structure and set isDirty flags
  const groups: StylesheetGroup[] = [];
  for (const [stylesheetId, group] of groupMap.entries()) {
    // Set isDirty flags
    for (const color of group.backgrounds.values()) {
      color.isDirty = color.anyDirty;
    }
    for (const color of group.text.values()) {
      color.isDirty = color.anyDirty;
    }
    for (const color of group.borders.values()) {
      color.isDirty = color.anyDirty;
    }

    // Add default stylesheet colors if not already present
    if (stylesheetId) {
      const stylesheet = diagram.document.styles.getNodeStyle(stylesheetId) ?? diagram.document.styles.getEdgeStyle(stylesheetId);
      if (stylesheet?.props) {
        const props = stylesheet.props as Record<string, unknown>;

        // Add default background color if it's a node stylesheet
        if (props.fill && typeof props.fill === 'object') {
          const fillColor = (props.fill as { color?: string }).color;
          if (fillColor) {
            const resolvedColor = resolveCSSVariable(fillColor);
            if (resolvedColor && !group.backgrounds.has(resolvedColor)) {
              group.backgrounds.set(resolvedColor, {
                color: resolvedColor,
                rawColor: fillColor,
                elements: [],
                count: 0,
                isDirty: false,
                anyDirty: false
              });
            }
          }
        }

        // Add default stroke/border color
        if (props.stroke && typeof props.stroke === 'object') {
          const strokeColor = (props.stroke as { color?: string }).color;
          if (strokeColor) {
            const resolvedColor = resolveCSSVariable(strokeColor);
            if (resolvedColor && !group.borders.has(resolvedColor)) {
              group.borders.set(resolvedColor, {
                color: resolvedColor,
                rawColor: strokeColor,
                elements: [],
                count: 0,
                isDirty: false,
                anyDirty: false
              });
            }
          }
        }
      }

      // Add default text color from text stylesheet
      const textStylesheet = diagram.document.styles.getTextStyle(stylesheetId);
      if (textStylesheet?.props.text && typeof textStylesheet.props.text === 'object') {
        const textColor = (textStylesheet.props.text as { color?: string }).color;
        if (textColor) {
          const resolvedColor = resolveCSSVariable(textColor);
          if (resolvedColor && !group.text.has(resolvedColor)) {
            group.text.set(resolvedColor, {
              color: resolvedColor,
              rawColor: textColor,
              elements: [],
              count: 0,
              isDirty: false,
              anyDirty: false
            });
          }
        }
      }
    }

    // Sort colors by count (descending) - first color is most common (likely default)
    const backgrounds = Array.from(group.backgrounds.values()).sort((a, b) => b.count - a.count);
    const text = Array.from(group.text.values()).sort((a, b) => b.count - a.count);
    const borders = Array.from(group.borders.values()).sort((a, b) => b.count - a.count);

    const totalElements = backgrounds.reduce((sum, c) => sum + c.count, 0) +
                         text.reduce((sum, c) => sum + c.count, 0) +
                         borders.reduce((sum, c) => sum + c.count, 0);

    groups.push({
      stylesheetId,
      stylesheetName: group.stylesheetName,
      stylesheetType: group.stylesheetType,
      colors: { backgrounds, text, borders },
      totalElements
    });
  }

  // Sort groups: named stylesheets first (alphabetically), then "No stylesheet"
  return groups.sort((a, b) => {
    if (a.stylesheetId === null) return 1;
    if (b.stylesheetId === null) return -1;
    return a.stylesheetName.localeCompare(b.stylesheetName);
  });
};

