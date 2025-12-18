import { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';
import {
  createThumbnailDiagramForEdge,
  createThumbnailDiagramForNode
} from '@diagram-craft/canvas-app/diagramThumbnail';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { type EdgeProps, type ElementProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';

export type StyleFilterType = 'all' | 'fill' | 'stroke' | 'shadow' | 'effects' | 'text';

export type StyleCombination = {
  styleHash: string;
  elements: DiagramElement[];
  count: number;
  previewDiagram: Diagram;
  previewElement: DiagramNode | DiagramEdge;
  stylesheetId: string | null;
  stylesheetName: string;
  isDirty: boolean;
  sampleProps: Partial<NodeProps | EdgeProps>;
  nodeType: string;
};

export type TextStyleCombination = {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string | undefined;
  elements: DiagramElement[];
  count: number;
  stylesheetId: string | null;
  stylesheetName: string;
  isDirty: boolean;
};

export type StylesheetGroup = {
  stylesheetId: string | null;
  stylesheetName: string;
  stylesheetType: 'node' | 'edge' | 'text' | null;
  styles: StyleCombination[];
  totalElements: number;
};

export type TextStylesheetGroup = {
  stylesheetId: string | null;
  stylesheetName: string;
  stylesheetType: 'node' | 'edge' | 'text' | null;
  styles: TextStyleCombination[];
  totalElements: number;
};

const PREVIEW_CACHE = new Map<string, { diagram: Diagram; element: DiagramNode | DiagramEdge }>();

export const extractAppearanceProps = (element: DiagramElement): Partial<NodeProps | EdgeProps> => {
  if (isNode(element)) {
    const props = element.renderProps;
    return {
      fill: props.fill,
      stroke: props.stroke,
      shadow: props.shadow,
      effects: props.effects,
      text: props.text,
      geometry: props.geometry
    };
  } else {
    const props = element.renderProps as Partial<EdgeProps>;
    return {
      stroke: props.stroke,
      shadow: props.shadow,
      effects: props.effects,
      arrow: props.arrow
    };
  }
};

export const extractFilteredProps = (
  el: DiagramElement,
  filter: StyleFilterType
): Partial<NodeProps | EdgeProps> => {
  switch (filter) {
    case 'fill':
      if (isNode(el)) {
        return { fill: el.renderProps.fill };
      } else {
        return {};
      }
    case 'stroke':
      if (isNode(el)) {
        return { stroke: el.renderProps.stroke };
      } else {
        return {
          stroke: el.renderProps.stroke,
          arrow: (el.renderProps as Partial<EdgeProps>).arrow
        };
      }
    case 'shadow':
      return { shadow: el.renderProps.shadow };
    case 'effects':
      return { effects: el.renderProps.effects };
    case 'text':
      if (isNode(el)) {
        return { text: el.renderProps.text };
      } else {
        return {};
      }

    default:
      return extractAppearanceProps(el);
  }
};

const sortKeys = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
};

export const createStyleHash = (props: Partial<NodeProps | EdgeProps>): string => {
  const sorted = sortKeys(props);
  return JSON.stringify(sorted);
};

export const createPreview = (props: Partial<ElementProps>, type: string, defs: Definitions) => {
  if (type === 'edge') {
    const { diagram, edge } = createThumbnailDiagramForEdge((_: Diagram, layer: RegularLayer) => {
      return ElementFactory.edge(
        newid(),
        new FreeEndpoint({ x: 5, y: 25 }),
        new FreeEndpoint({ x: 45, y: 25 }),
        props as Partial<EdgeProps>,
        {},
        [],
        layer
      );
    }, defs);

    diagram.viewBox.dimensions = { w: 50, h: 50 };
    diagram.viewBox.offset = { x: 0, y: 0 };

    return { diagram, element: edge };
  } else {
    const { diagram, node } = createThumbnailDiagramForNode((_: Diagram, layer: RegularLayer) => {
      return ElementFactory.node(
        newid(),
        type,
        { x: 5, y: 5, w: 40, h: 40, r: 0 },
        layer,
        props as Partial<NodeProps>,
        {}
      );
    }, defs);

    // Set viewBox to show the node with padding
    diagram.viewBox.dimensions = { w: 50, h: 50 };
    diagram.viewBox.offset = { x: 0, y: 0 };

    return { diagram, element: node };
  }
};

const isPropsDirty = (
  props: Record<string, unknown>,
  stylesheetProps: Record<string, unknown>,
  path: string[] = []
): boolean => {
  for (const key of Object.keys(props)) {
    const value = props[key];
    const stylesheetValue = stylesheetProps[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (stylesheetValue === undefined) {
        // Empty object is equivalent to undefined
        if (Object.keys(value).length === 0) continue;

        // Check if all properties match defaults
        const isAllDefaults = Object.keys(value).every(k => {
          const fullPath = [...path, key, k].join('.');
          return nodeDefaults.isSameAsDefaults(props, fullPath as keyof NodeProps);
        });
        if (isAllDefaults) continue;

        return true;
      } else if (typeof stylesheetValue === 'object' && stylesheetValue !== null) {
        const dirty = isPropsDirty(
          value as Record<string, unknown>,
          stylesheetValue as Record<string, unknown>,
          [...path, key]
        );
        if (dirty) return true;
      }
    } else if (value !== undefined && value !== stylesheetValue) {
      return true;
    }
  }
  return false;
};

export const checkStyleDirty = (
  element: DiagramElement,
  stylesheet: Stylesheet<'node'> | Stylesheet<'edge'> | undefined
): boolean => {
  if (!stylesheet) return false;

  const propsFromElement = stylesheet.getPropsFromElement(element);
  return isPropsDirty(
    propsFromElement as Record<string, unknown>,
    stylesheet.props as Record<string, unknown>
  );
};

export const collectTextStyles = (
  diagram: Diagram,
  selectedElements?: DiagramElement[]
): TextStylesheetGroup[] => {
  const textStyleMap = new Map<string, TextStyleCombination & { anyDirty: boolean }>();

  // Use selected elements if provided, otherwise all elements from diagram
  const elements =
    selectedElements && selectedElements.length > 0 ? selectedElements : [...diagram.allElements()];

  // Only process nodes (edges don't have text)
  const nodes = elements.filter(isNode);

  for (const node of nodes) {
    const text = node.getText();
    if (!text || text.trim() === '') {
      continue;
    }

    const textProps = node.renderProps.text;
    const fontFamily = textProps?.font ?? 'sans-serif';
    const fontSize = textProps?.fontSize ?? 10;
    const bold = textProps?.bold ?? false;
    const italic = textProps?.italic ?? false;
    const color = textProps?.color;

    // Get text stylesheet info
    const textStylesheetId = node.metadata.textStyle ?? null;
    const textStylesheet = textStylesheetId
      ? diagram.document.styles.getTextStyle(textStylesheetId)
      : undefined;
    const stylesheetName = textStylesheet?.name ?? 'No stylesheet';

    // Check if this node's text properties differ from stylesheet
    const isDirty = textStylesheet
      ? isPropsDirty(
          { text: textProps } as Record<string, unknown>,
          { text: textStylesheet.props.text } as Record<string, unknown>
        )
      : false;

    const key = `${fontFamily}|${fontSize}|${bold}|${italic}|${color}|${textStylesheetId}`;

    if (!textStyleMap.has(key)) {
      textStyleMap.set(key, {
        fontFamily,
        fontSize,
        bold,
        italic,
        color,
        elements: [],
        count: 0,
        stylesheetId: textStylesheetId,
        stylesheetName,
        isDirty: false,
        anyDirty: false
      });
    }

    const combo = textStyleMap.get(key)!;
    combo.elements.push(node);
    combo.count++;
    if (isDirty) {
      combo.anyDirty = true;
    }
  }

  // Set isDirty flag based on anyDirty
  for (const combo of textStyleMap.values()) {
    combo.isDirty = combo.anyDirty;
  }

  // Group by stylesheet
  const groupMap = new Map<string | null, TextStylesheetGroup>();
  for (const textStyle of textStyleMap.values()) {
    const key = textStyle.stylesheetId;
    if (!groupMap.has(key)) {
      const stylesheet = key ? diagram.document.styles.getTextStyle(key) : undefined;
      groupMap.set(key, {
        stylesheetId: key,
        stylesheetName: textStyle.stylesheetName,
        stylesheetType: stylesheet?.type ?? null,
        styles: [],
        totalElements: 0
      });
    }

    const group = groupMap.get(key)!;
    group.styles.push(textStyle);
    group.totalElements += textStyle.count;
  }

  // Add default stylesheet text styles if not already present, or merge with existing
  for (const group of groupMap.values()) {
    if (group.stylesheetId) {
      const stylesheet = diagram.document.styles.getTextStyle(group.stylesheetId);
      if (stylesheet?.props) {
        const props = stylesheet.props as {
          text?: {
            font?: string;
            fontSize?: number;
            bold?: boolean;
            italic?: boolean;
            color?: string;
          };
        };
        const textProps = props.text;
        if (!textProps) continue;

        const defaultFont = textProps.font ?? 'sans-serif';
        const defaultSize = textProps.fontSize ?? 10;
        const defaultBold = textProps.bold ?? false;
        const defaultItalic = textProps.italic ?? false;
        const defaultColor = textProps.color;

        // Check if this text style already exists
        const existingStyle = group.styles.find(
          s =>
            s.fontFamily === defaultFont &&
            s.fontSize === defaultSize &&
            s.bold === defaultBold &&
            s.italic === defaultItalic &&
            s.color === defaultColor
        );

        if (existingStyle) {
          // Move existing style to the beginning if it's not dirty (clean stylesheet usage)
          if (!existingStyle.isDirty) {
            const index = group.styles.indexOf(existingStyle);
            group.styles.splice(index, 1);
            group.styles.unshift(existingStyle);
          }
        } else {
          // Add the default text style with 0 count at the beginning
          group.styles.unshift({
            fontFamily: defaultFont,
            fontSize: defaultSize,
            bold: defaultBold,
            italic: defaultItalic,
            color: defaultColor,
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

  // Sort groups: named stylesheets first (alphabetically), then "No stylesheet"
  const groups = Array.from(groupMap.values());
  return groups.sort((a, b) => {
    if (a.stylesheetId === null) return 1;
    if (b.stylesheetId === null) return -1;
    return a.stylesheetName.localeCompare(b.stylesheetName);
  });
};

export const collectStyles = (
  diagram: Diagram,
  selectedElements?: DiagramElement[],
  filterType: StyleFilterType = 'all'
): StylesheetGroup[] => {
  const styleMap = new Map<string, StyleCombination & { nodeTypes: Set<string> }>();

  // Use selected elements if provided, otherwise all elements from diagram
  const elements =
    selectedElements && selectedElements.length > 0 ? selectedElements : [...diagram.allElements()];

  // First pass: collect all elements by style and track their node types
  for (const element of elements) {
    const stylesheetId = element.metadata.style ?? null;
    const stylesheet = stylesheetId
      ? isNode(element)
        ? diagram.document.styles.getNodeStyle(stylesheetId)
        : diagram.document.styles.getEdgeStyle(stylesheetId)
      : undefined;
    const stylesheetName = stylesheet?.name ?? 'No stylesheet';

    const isDirty = stylesheet ? checkStyleDirty(element, stylesheet) : false;

    // If element has a stylesheet and is not dirty, use stylesheet props for hashing
    // This ensures clean stylesheet usage gets grouped together
    let appearanceProps: Partial<NodeProps | EdgeProps>;
    if (stylesheet && !isDirty) {
      // Use filtered stylesheet props
      const stylesheetProps = stylesheet.props as Partial<NodeProps>;
      switch (filterType) {
        case 'fill':
          appearanceProps = { fill: stylesheetProps.fill };
          break;
        case 'stroke':
          appearanceProps = { stroke: stylesheetProps.stroke };
          break;
        case 'shadow':
          appearanceProps = { shadow: stylesheetProps.shadow };
          break;
        case 'effects':
          appearanceProps = { effects: stylesheetProps.effects };
          break;
        case 'text':
          appearanceProps = { text: stylesheetProps.text };
          break;
        case 'all':
        default:
          appearanceProps = {
            fill: stylesheetProps.fill,
            stroke: stylesheetProps.stroke,
            shadow: stylesheetProps.shadow,
            effects: stylesheetProps.effects,
            text: stylesheetProps.text,
            geometry: stylesheetProps.geometry
          };
      }
    } else {
      // Use element's actual rendered props
      appearanceProps = extractFilteredProps(element, filterType);
    }

    const styleHash = createStyleHash(appearanceProps);

    if (!styleMap.has(styleHash)) {
      styleMap.set(styleHash, {
        styleHash,
        elements: [],
        count: 0,
        previewDiagram: null as any,
        previewElement: null as any,
        stylesheetId,
        stylesheetName,
        isDirty,
        sampleProps: appearanceProps,
        nodeType: 'rect',
        nodeTypes: new Set()
      });
    }

    const combo = styleMap.get(styleHash)!;
    combo.elements.push(element);
    combo.count++;
    // For edges, use 'edge' as the type; for nodes, use their nodeType
    combo.nodeTypes.add(isNode(element) ? element.nodeType : 'edge');
  }

  // Second pass: create preview diagrams using the appropriate node type
  for (const combo of styleMap.values()) {
    // Use the common node type if all nodes share the same type, otherwise use rect
    const nodeType = combo.nodeTypes.size === 1 ? Array.from(combo.nodeTypes)[0]! : 'rect';
    combo.nodeType = nodeType;

    // Create preview diagram (cached by style hash + node type)
    const cacheKey = `${combo.styleHash}-${nodeType}`;
    let preview = PREVIEW_CACHE.get(cacheKey);
    if (!preview) {
      preview = createPreview(combo.sampleProps, nodeType, diagram.document.definitions);
      PREVIEW_CACHE.set(cacheKey, preview);
    }

    combo.previewDiagram = preview.diagram;
    combo.previewElement = preview.element;
  }

  // Group by stylesheet
  const groupMap = new Map<string | null, StylesheetGroup>();
  for (const style of styleMap.values()) {
    const key = style.stylesheetId;
    if (!groupMap.has(key)) {
      // Try to get stylesheet as node or edge style
      const stylesheet = key
        ? (diagram.document.styles.getNodeStyle(key) ?? diagram.document.styles.getEdgeStyle(key))
        : undefined;
      groupMap.set(key, {
        stylesheetId: key,
        stylesheetName: style.stylesheetName,
        stylesheetType: stylesheet?.type ?? null,
        styles: [],
        totalElements: 0
      });
    }

    const group = groupMap.get(key)!;
    group.styles.push(style);
    group.totalElements += style.count;
  }

  // Add default stylesheet style if not already present, or merge with existing
  for (const group of groupMap.values()) {
    if (group.stylesheetId) {
      const stylesheet =
        diagram.document.styles.getNodeStyle(group.stylesheetId) ??
        diagram.document.styles.getEdgeStyle(group.stylesheetId);
      if (stylesheet?.props) {
        // Extract filtered appearance props from stylesheet based on filterType
        const stylesheetProps = stylesheet.props as Partial<NodeProps>;
        let appearanceProps: Partial<NodeProps>;

        switch (filterType) {
          case 'fill':
            appearanceProps = { fill: stylesheetProps.fill };
            break;
          case 'stroke':
            appearanceProps = { stroke: stylesheetProps.stroke };
            break;
          case 'shadow':
            appearanceProps = { shadow: stylesheetProps.shadow };
            break;
          case 'effects':
            appearanceProps = { effects: stylesheetProps.effects };
            break;
          case 'text':
            appearanceProps = { text: stylesheetProps.text };
            break;
          case 'all':
          default:
            appearanceProps = {
              fill: stylesheetProps.fill,
              stroke: stylesheetProps.stroke,
              shadow: stylesheetProps.shadow,
              effects: stylesheetProps.effects,
              text: stylesheetProps.text,
              geometry: stylesheetProps.geometry
            };
        }

        const styleHash = createStyleHash(appearanceProps);

        // Check if this style already exists
        const existingStyle = group.styles.find(s => s.styleHash === styleHash);

        if (existingStyle) {
          // Move existing style to the beginning if it's not dirty (clean stylesheet usage)
          if (!existingStyle.isDirty) {
            const index = group.styles.indexOf(existingStyle);
            group.styles.splice(index, 1);
            group.styles.unshift(existingStyle);
          }
        } else {
          // Determine node type for preview (use 'rect' for nodes, 'edge' for edges)
          const nodeType = stylesheet.type === 'edge' ? 'edge' : 'rect';

          // Create preview diagram
          const cacheKey = `${styleHash}-${nodeType}`;
          let preview = PREVIEW_CACHE.get(cacheKey);
          if (!preview) {
            preview = createPreview(appearanceProps, nodeType, diagram.document.definitions);
            PREVIEW_CACHE.set(cacheKey, preview);
          }

          // Add the default style with 0 count at the beginning
          group.styles.unshift({
            styleHash,
            elements: [],
            count: 0,
            previewDiagram: preview.diagram,
            previewElement: preview.element,
            stylesheetId: group.stylesheetId,
            stylesheetName: group.stylesheetName,
            isDirty: false,
            sampleProps: appearanceProps,
            nodeType
          });
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
