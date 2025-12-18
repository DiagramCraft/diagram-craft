import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

export type FontCombination = {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  elements: DiagramNode[];
  count: number;
  stylesheetId: string | null;
  stylesheetName: string;
  isDirty: boolean;
};

export type StylesheetGroup = {
  stylesheetId: string | null;
  stylesheetName: string;
  stylesheetType: 'text' | null;
  fonts: FontCombination[];
  totalElements: number;
};

const getAllNodesFromDiagram = (diagram: Diagram): DiagramNode[] =>
  diagram.layers.all
    .filter((layer): layer is RegularLayer => layer.type === 'regular')
    .flatMap(layer => Array.from(layer.elements))
    .filter(isNode);

const checkFontDirty = (
  node: DiagramNode,
  stylesheetTextProps: { font?: string; fontSize?: number; bold?: boolean; italic?: boolean } | undefined
): boolean => {
  if (!stylesheetTextProps) return false;

  const nodeTextProps = node.renderProps.text;
  if (!nodeTextProps) return false;

  const nodeFont = nodeTextProps.font ?? 'sans-serif';
  const nodeFontSize = nodeTextProps.fontSize ?? 10;
  const nodeBold = nodeTextProps.bold ?? false;
  const nodeItalic = nodeTextProps.italic ?? false;

  const stylesheetFont = stylesheetTextProps.font;
  const stylesheetFontSize = stylesheetTextProps.fontSize;
  const stylesheetBold = stylesheetTextProps.bold;
  const stylesheetItalic = stylesheetTextProps.italic;

  // Check if any text property differs from stylesheet
  if (stylesheetFont !== undefined && nodeFont !== stylesheetFont) return true;
  if (stylesheetFontSize !== undefined && nodeFontSize !== stylesheetFontSize) return true;
  if (stylesheetBold !== undefined && nodeBold !== stylesheetBold) return true;
  if (stylesheetItalic !== undefined && nodeItalic !== stylesheetItalic) return true;

  return false;
};

export const collectFonts = (diagram: Diagram, selectedNodes?: DiagramNode[]): StylesheetGroup[] => {
  const fontMap = new Map<string, FontCombination & { anyDirty: boolean }>();

  // Use selected nodes if provided, otherwise all nodes from diagram
  const elements = selectedNodes && selectedNodes.length > 0
    ? selectedNodes
    : getAllNodesFromDiagram(diagram);

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

    // Get text stylesheet info
    const textStylesheetId = node.metadata.textStyle ?? null;
    const textStylesheet = textStylesheetId
      ? diagram.document.styles.getTextStyle(textStylesheetId)
      : undefined;
    const stylesheetName = textStylesheet?.name ?? 'No stylesheet';

    // Check if this node's font properties differ from stylesheet
    const isDirty = textStylesheet
      ? checkFontDirty(node, textStylesheet.props.text)
      : false;

    const key = `${fontFamily}|${fontSize}|${bold}|${italic}|${textStylesheetId}`;

    if (!fontMap.has(key)) {
      fontMap.set(key, {
        fontFamily,
        fontSize,
        bold,
        italic,
        elements: [],
        count: 0,
        stylesheetId: textStylesheetId,
        stylesheetName,
        isDirty: false,
        anyDirty: false
      });
    }

    const combo = fontMap.get(key)!;
    combo.elements.push(node);
    combo.count++;
    if (isDirty) {
      combo.anyDirty = true;
    }
  }

  // Set isDirty flag based on anyDirty
  for (const combo of fontMap.values()) {
    combo.isDirty = combo.anyDirty;
  }

  // Group by stylesheet
  const groupMap = new Map<string | null, StylesheetGroup>();
  for (const font of fontMap.values()) {
    const key = font.stylesheetId;
    if (!groupMap.has(key)) {
      const stylesheet = key ? diagram.document.styles.getTextStyle(key) : undefined;
      groupMap.set(key, {
        stylesheetId: key,
        stylesheetName: font.stylesheetName,
        stylesheetType: stylesheet?.type ?? null,
        fonts: [],
        totalElements: 0
      });
    }

    const group = groupMap.get(key)!;
    group.fonts.push(font);
    group.totalElements += font.count;
  }

  // Add default stylesheet fonts if not already present
  for (const group of groupMap.values()) {
    if (group.stylesheetId) {
      const stylesheet = diagram.document.styles.getTextStyle(group.stylesheetId);
      if (stylesheet?.props) {
        const props = stylesheet.props as { text?: { font?: string; fontSize?: number; bold?: boolean; italic?: boolean } };
        const textProps = props.text;
        if (textProps) {
          const defaultFont = textProps.font ?? 'sans-serif';
          const defaultSize = textProps.fontSize ?? 10;
          const defaultBold = textProps.bold ?? false;
          const defaultItalic = textProps.italic ?? false;

          // Check if this font combination already exists
          const exists = group.fonts.some(
            f =>
              f.fontFamily === defaultFont &&
              f.fontSize === defaultSize &&
              f.bold === defaultBold &&
              f.italic === defaultItalic
          );

          if (!exists) {
            // Add the default font with 0 count at the beginning
            group.fonts.unshift({
              fontFamily: defaultFont,
              fontSize: defaultSize,
              bold: defaultBold,
              italic: defaultItalic,
              elements: [],
              count: 0,
              stylesheetId: group.stylesheetId,
              stylesheetName: group.stylesheetName,
              isDirty: false
            });
          }
        }
      }
    }
  }

  // Sort groups: named stylesheets first (alphabetically), then "No stylesheet"
  const groups = Array.from(groupMap.values());
  return groups.sort((a, b) => {
    if (a.stylesheetId === null) return 1;
    if (b.stylesheetId === null) return -1;
    return a.stylesheetName.localeCompare(b.stylesheetName);
  });
};

