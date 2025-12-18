import { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
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
import { edgeDefaults, nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { deepMerge } from '@diagram-craft/utils/object';
import { isEmptyString } from '@diagram-craft/utils/strings';

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
  differences: string[]; // Cached differences from stylesheet
};

export type TextStyleCombination = {
  elements: DiagramElement[];
  stylesheetId: string | undefined;
  stylesheetName: string;
  differences: string[];
  props: NodePropsForRendering;
};

export type TextStylesheetGroup = {
  stylesheetId: string | undefined;
  stylesheetName: string;
  stylesheetType: 'node' | 'edge' | 'text' | null;
  styles: TextStyleCombination[];
  totalElements: number;
};

export type StylesheetGroup = {
  stylesheetId: string | null;
  stylesheetName: string;
  stylesheetType: 'node' | 'edge' | 'text' | null;
  styles: StyleCombination[];
  totalElements: number;
};

const PREVIEW_CACHE = new Map<string, { diagram: Diagram; element: DiagramNode | DiagramEdge }>();

const extractPropsToConsider = (
  el: DiagramElement,
  filter: StyleFilterType
): Partial<NodeProps | EdgeProps> => {
  switch (filter) {
    case 'fill':
      if (isNode(el)) {
        return { fill: el.storedProps.fill };
      } else {
        return {};
      }
    case 'stroke':
      if (isNode(el)) {
        return { stroke: el.storedProps.stroke };
      } else {
        return {
          stroke: el.storedProps.stroke,
          arrow: (el.storedProps as Partial<EdgeProps>).arrow
        };
      }
    case 'shadow':
      return { shadow: el.storedProps.shadow };
    case 'effects':
      return { effects: el.storedProps.effects };
    case 'text':
      if (isNode(el)) {
        return { text: el.storedProps.text };
      } else {
        return {};
      }

    default:
      if (isNode(el)) {
        const props = el.storedProps;
        return {
          fill: props.fill,
          stroke: props.stroke,
          shadow: props.shadow,
          effects: props.effects,
          text: props.text,
          geometry: props.geometry
        };
      } else {
        const props = el.storedProps as Partial<EdgeProps>;
        return {
          stroke: props.stroke,
          shadow: props.shadow,
          effects: props.effects,
          arrow: props.arrow
        };
      }
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
  stylesheet: Stylesheet<'node'> | Stylesheet<'edge'> | Stylesheet<'text'> | undefined
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
  elements: DiagramElement[]
): TextStylesheetGroup[] => {
  const textStyleMap = new Map<string, TextStyleCombination>();

  const nodes = elements.filter(isNode);
  for (const node of nodes) {
    const text = node.getText();
    if (isEmptyString(text)) continue;

    const props = extractPropsToConsider(node, 'text');

    // Get text stylesheet info
    const stylesheetId = node.metadata.textStyle ?? undefined;
    const textStylesheet = stylesheetId
      ? diagram.document.styles.getTextStyle(stylesheetId)
      : undefined;
    const stylesheetName = textStylesheet?.name ?? 'No stylesheet';

    const differences = computeStyleDifferences(props, textStylesheet?.props, isNode(node));

    const key = `${differences.join('|')}|${stylesheetId}`;

    if (!textStyleMap.has(key)) {
      textStyleMap.set(key, {
        stylesheetId,
        stylesheetName,
        differences,
        props: deepMerge({}, node.renderProps) as NodePropsForRendering,
        elements: []
      });
    }

    textStyleMap.get(key)!.elements.push(node);
  }

  // Group by stylesheet
  const groupMap = new Map<string | undefined, TextStylesheetGroup>();
  for (const textStyle of textStyleMap.values()) {
    const key = textStyle.stylesheetId;
    if (!groupMap.has(key)) {
      const stylesheet = key ? diagram.document.styles.getTextStyle(key) : undefined;
      groupMap.set(key, {
        stylesheetId: key,
        stylesheetName: textStyle.stylesheetName,
        stylesheetType: stylesheet?.type ?? null,
        styles: [
          {
            elements: [],
            stylesheetId: key,
            stylesheetName: textStyle.stylesheetName,
            differences: [],
            props: textStyle.props
          }
        ],
        totalElements: 0
      });
    }

    const group = groupMap.get(key)!;
    if (textStyle.differences.length === 0) {
      group.styles[0] = textStyle;
    } else {
      group.styles.push(textStyle);
    }
    group.totalElements += textStyle.elements.length;
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
      appearanceProps = extractPropsToConsider(element, filterType) as Partial<
        NodeProps | EdgeProps
      >;
    }

    // Compute differences for dirty styles - this will be used as the hash
    const isNodeStyle = isNode(element);
    const differences = isDirty
      ? computeStyleDifferences(
          appearanceProps,
          stylesheet?.props as Partial<NodeProps | EdgeProps>,
          isNodeStyle
        )
      : [];

    // Include stylesheet ID and type in the hash to separate node and edge styles
    // Use differences as the hash if dirty, otherwise use the appearance props
    const stylesheetType = stylesheet?.type ?? null;
    const baseHash =
      differences.length > 0 ? differences.join('|') : createStyleHash(appearanceProps);
    const styleHash = `${baseHash}|${stylesheetId}|${stylesheetType}`;

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
        nodeTypes: new Set(),
        differences
      });
    }

    const combo = styleMap.get(styleHash)!;
    combo.elements.push(element);
    combo.count++;
    // Track if ANY element is dirty
    if (isDirty) {
      combo.isDirty = true;
    }
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

  // Group by stylesheet - need to include type to distinguish node vs edge stylesheets with same ID
  const groupMap = new Map<string, StylesheetGroup>();
  for (const style of styleMap.values()) {
    // Determine stylesheet type from the elements in this style
    const hasNodes = style.elements.some(isNode);

    // Get the appropriate stylesheet based on element type
    const stylesheet = style.stylesheetId
      ? hasNodes
        ? diagram.document.styles.getNodeStyle(style.stylesheetId)
        : diagram.document.styles.getEdgeStyle(style.stylesheetId)
      : undefined;

    const stylesheetType = stylesheet?.type ?? null;

    // Use a composite key that includes both stylesheet ID and type
    const groupKey = style.stylesheetId
      ? `${style.stylesheetId}|${stylesheetType}`
      : 'no-stylesheet';

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        stylesheetId: style.stylesheetId,
        stylesheetName: style.stylesheetName,
        stylesheetType,
        styles: [],
        totalElements: 0
      });
    }

    const group = groupMap.get(groupKey)!;
    group.styles.push(style);
    group.totalElements += style.count;
  }

  // Sort groups: named stylesheets first (alphabetically), then "No stylesheet"
  const groups = Array.from(groupMap.values());
  return groups.sort((a, b) => {
    if (a.stylesheetId === null) return 1;
    if (b.stylesheetId === null) return -1;
    return a.stylesheetName.localeCompare(b.stylesheetName);
  });
};

/**
 * Compute the differences between element props and the merged default + stylesheet props
 * Returns an array of formatted strings like "text.fontSize = 14" or "fill.color = #ff0000"
 *
 * @param elementProps - The element's appearance props (extracted)
 * @param stylesheetProps - The stylesheet's props (optional)
 * @param isNodeStyle - Whether this is a node style (true) or edge style (false)
 */
export const computeStyleDifferences = (
  elementProps: Partial<NodeProps | EdgeProps>,
  stylesheetProps: Partial<NodeProps | EdgeProps> | undefined,
  isNodeStyle: boolean
): string[] => {
  if (!stylesheetProps) {
    return [];
  }

  // Get default props and merge with stylesheet props based on element type
  const mergedStylesheetProps = isNodeStyle
    ? deepMerge({}, nodeDefaults.applyDefaults({}), stylesheetProps as Partial<NodeProps>)
    : deepMerge({}, edgeDefaults.applyDefaults({}), stylesheetProps as Partial<EdgeProps>);

  const differences: string[] = [];

  // Helper function to format property path and value
  const formatDiff = (path: string, value: unknown): string => {
    if (typeof value === 'object' && value !== null) {
      return `${path} = ${JSON.stringify(value)}`;
    }
    return `${path} = ${value}`;
  };

  // Helper to deep compare and find differences
  const compareProps = (stylesheetValue: unknown, elementValue: unknown, path: string): void => {
    // If element doesn't have this prop, skip
    if (elementValue === undefined) {
      return;
    }

    // If values are objects, recurse
    if (
      typeof stylesheetValue === 'object' &&
      stylesheetValue !== null &&
      typeof elementValue === 'object' &&
      elementValue !== null &&
      !Array.isArray(stylesheetValue) &&
      !Array.isArray(elementValue)
    ) {
      // Compare nested properties
      const elementObj = elementValue as Record<string, unknown>;
      const stylesheetObj = stylesheetValue as Record<string, unknown>;

      for (const key of Object.keys(elementObj)) {
        compareProps(stylesheetObj[key], elementObj[key], `${path}.${key}`);
      }
      return;
    }

    // Compare primitive values or arrays
    if (JSON.stringify(stylesheetValue) !== JSON.stringify(elementValue)) {
      differences.push(formatDiff(path, elementValue));
    }
  };

  // Compare all top-level properties
  for (const key of Object.keys(elementProps)) {
    const mergedValue = (mergedStylesheetProps as Record<string, unknown>)[key];
    const elementValue = (elementProps as Record<string, unknown>)[key];
    compareProps(mergedValue, elementValue, key);
  }

  return differences;
};

/**
 * Compute the differences between text style props and the merged default + stylesheet props
 * Returns an array of formatted strings like "text.fontSize = 14" or "text.color = #ff0000"
 *
 * @param fontFamily - The element's font family
 * @param fontSize - The element's font size
 * @param bold - Whether the text is bold
 * @param italic - Whether the text is italic
 * @param color - The text color
 * @param stylesheetTextProps - The stylesheet's text props (nested under 'text' property)
 */
export const computeTextStyleDifferences = (
  fontFamily: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
  color: string | undefined,
  stylesheetTextProps: Record<string, unknown> | undefined
): string[] => {
  if (!stylesheetTextProps) {
    return [];
  }

  // Get default text props
  const defaultTextProps = nodeDefaults.applyDefaults({}).text ?? {};

  // Merge default props with stylesheet props
  const mergedStylesheetProps = deepMerge({}, defaultTextProps, stylesheetTextProps);

  const differences: string[] = [];

  // Compare font family
  if (fontFamily !== mergedStylesheetProps.font) {
    differences.push(`text.font = ${fontFamily}`);
  }

  // Compare font size
  if (fontSize !== mergedStylesheetProps.fontSize) {
    differences.push(`text.fontSize = ${fontSize}`);
  }

  // Compare bold
  if (bold !== (mergedStylesheetProps.bold ?? false)) {
    differences.push(`text.bold = ${bold}`);
  }

  // Compare italic
  if (italic !== (mergedStylesheetProps.italic ?? false)) {
    differences.push(`text.italic = ${italic}`);
  }

  // Compare color
  if (color !== mergedStylesheetProps.color) {
    differences.push(`text.color = ${color}`);
  }

  return differences;
};
