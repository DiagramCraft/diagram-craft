import { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';
import { createThumbnailDiagramForNode } from '@diagram-craft/canvas-app/diagramThumbnail';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { NodeProps } from '@diagram-craft/model/diagramProps';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

export type StyleCombination = {
  styleHash: string;
  elements: DiagramElement[];
  count: number;
  previewDiagram: Diagram;
  previewNode: DiagramNode;
  stylesheetId: string | null;
  stylesheetName: string;
  isDirty: boolean;
  sampleProps: Partial<NodeProps>;
  nodeType: string;
};

export type StylesheetGroup = {
  stylesheetId: string | null;
  stylesheetName: string;
  stylesheetType: 'node' | 'edge' | 'text' | null;
  styles: StyleCombination[];
  totalElements: number;
};

export type StyleScope = 'current-diagram' | 'entire-document';

const PREVIEW_CACHE = new Map<string, { diagram: Diagram; node: DiagramNode }>();

const getAllElementsFromDiagram = (diagram: Diagram): DiagramElement[] =>
  diagram.layers.all
    .filter((layer): layer is RegularLayer => layer.type === 'regular')
    .flatMap(layer => Array.from(layer.elements));

const getAllElementsFromDocument = (document: DiagramDocument): DiagramElement[] =>
  document.diagrams.flatMap(d => getAllElementsFromDiagram(d));

export const extractAppearanceProps = (element: DiagramElement): Partial<NodeProps> => {
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
    // For edges, only include stroke, shadow, effects
    const props = element.renderProps;
    return {
      stroke: props.stroke,
      shadow: props.shadow,
      effects: props.effects
    };
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

export const createStyleHash = (props: Partial<NodeProps>): string => {
  const sorted = sortKeys(props);
  return JSON.stringify(sorted);
};

export const createPreviewDiagram = (
  props: Partial<NodeProps>,
  nodeType: string,
  definitions: Definitions
): { diagram: Diagram; node: DiagramNode } => {
  const { diagram, node } = createThumbnailDiagramForNode(
    (_d: Diagram, l: RegularLayer) => {
      return ElementFactory.node(
        newid(),
        nodeType,
        { x: 0, y: 0, w: 40, h: 40, r: 0 },
        l,
        props,
        {}
      );
    },
    definitions
  );

  // Set viewBox to show the node with padding
  diagram.viewBox.dimensions = { w: 50, h: 50 };
  diagram.viewBox.offset = { x: -5, y: -5 };

  return { diagram, node };
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

export const collectStyles = (scope: StyleScope, diagram: Diagram): StylesheetGroup[] => {
  const styleMap = new Map<string, StyleCombination & { nodeTypes: Set<string> }>();
  const elements =
    scope === 'current-diagram'
      ? getAllElementsFromDiagram(diagram)
      : getAllElementsFromDocument(diagram.document);

  // First pass: collect all elements by style and track their node types
  for (const element of elements) {
    const appearanceProps = extractAppearanceProps(element);
    const styleHash = createStyleHash(appearanceProps);

    const stylesheetId = element.metadata.style ?? null;
    const stylesheet = stylesheetId
      ? isNode(element)
        ? diagram.document.styles.getNodeStyle(stylesheetId)
        : diagram.document.styles.getEdgeStyle(stylesheetId)
      : undefined;
    const stylesheetName = stylesheet?.name ?? 'No stylesheet';

    const isDirty = stylesheet ? checkStyleDirty(element, stylesheet) : false;

    if (!styleMap.has(styleHash)) {
      styleMap.set(styleHash, {
        styleHash,
        elements: [],
        count: 0,
        previewDiagram: null as any,
        previewNode: null as any,
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
      preview = createPreviewDiagram(combo.sampleProps, nodeType, diagram.document.definitions);
      PREVIEW_CACHE.set(cacheKey, preview);
    }

    combo.previewDiagram = preview.diagram;
    combo.previewNode = preview.node;
  }

  // Group by stylesheet
  const groupMap = new Map<string | null, StylesheetGroup>();
  for (const style of styleMap.values()) {
    const key = style.stylesheetId;
    if (!groupMap.has(key)) {
      // Try to get stylesheet as node or edge style
      const stylesheet = key
        ? diagram.document.styles.getNodeStyle(key) ?? diagram.document.styles.getEdgeStyle(key)
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

  // Add default stylesheet style if not already present
  for (const group of groupMap.values()) {
    if (group.stylesheetId) {
      const stylesheet = diagram.document.styles.getNodeStyle(group.stylesheetId) ?? diagram.document.styles.getEdgeStyle(group.stylesheetId);
      if (stylesheet?.props) {
        // Extract appearance props from stylesheet
        const stylesheetProps = stylesheet.props as Partial<NodeProps>;
        const appearanceProps: Partial<NodeProps> = {
          fill: stylesheetProps.fill,
          stroke: stylesheetProps.stroke,
          shadow: stylesheetProps.shadow,
          effects: stylesheetProps.effects,
          text: stylesheetProps.text,
          geometry: stylesheetProps.geometry
        };

        const styleHash = createStyleHash(appearanceProps);

        // Check if this style already exists
        const exists = group.styles.some(s => s.styleHash === styleHash);

        if (!exists) {
          // Determine node type for preview (use 'rect' for nodes, 'edge' for edges)
          const nodeType = stylesheet.type === 'edge' ? 'edge' : 'rect';

          // Create preview diagram
          const cacheKey = `${styleHash}-${nodeType}`;
          let preview = PREVIEW_CACHE.get(cacheKey);
          if (!preview) {
            preview = createPreviewDiagram(appearanceProps, nodeType, diagram.document.definitions);
            PREVIEW_CACHE.set(cacheKey, preview);
          }

          // Add the default style with 0 count at the beginning
          group.styles.unshift({
            styleHash,
            elements: [],
            count: 0,
            previewDiagram: preview.diagram,
            previewNode: preview.node,
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
