import { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
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
  elements: DiagramNode[];
  count: number;
  previewDiagram: Diagram;
  previewNode: DiagramNode;
  stylesheetId: string | null;
  stylesheetName: string;
  isDirty: boolean;
  sampleProps: Partial<NodeProps>;
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

const getAllNodesFromDiagram = (diagram: Diagram): DiagramNode[] =>
  diagram.layers.all
    .filter((layer): layer is RegularLayer => layer.type === 'regular')
    .flatMap(layer => Array.from(layer.elements))
    .filter(isNode);

const getAllNodesFromDocument = (document: DiagramDocument): DiagramNode[] =>
  document.diagrams.flatMap(d => getAllNodesFromDiagram(d));

export const extractAppearanceProps = (node: DiagramNode): Partial<NodeProps> => {
  const props = node.renderProps;

  return {
    fill: props.fill,
    stroke: props.stroke,
    shadow: props.shadow,
    effects: props.effects,
    text: props.text,
    geometry: props.geometry
  };
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
  definitions: Definitions
): { diagram: Diagram; node: DiagramNode } => {
  const { diagram, node } = createThumbnailDiagramForNode(
    (_d: Diagram, l: RegularLayer) => {
      return ElementFactory.node(
        newid(),
        'rect',
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
  element: DiagramNode,
  stylesheet: Stylesheet<'node'> | undefined
): boolean => {
  if (!stylesheet) return false;

  const propsFromElement = stylesheet.getPropsFromElement(element);
  return isPropsDirty(
    propsFromElement as Record<string, unknown>,
    stylesheet.props as Record<string, unknown>
  );
};

export const collectStyles = (scope: StyleScope, diagram: Diagram): StylesheetGroup[] => {
  const styleMap = new Map<string, StyleCombination>();
  const nodes =
    scope === 'current-diagram'
      ? getAllNodesFromDiagram(diagram)
      : getAllNodesFromDocument(diagram.document);

  for (const node of nodes) {
    // Extract appearance props
    const appearanceProps = extractAppearanceProps(node);
    const styleHash = createStyleHash(appearanceProps);

    // Get stylesheet info
    const stylesheetId = node.metadata.style ?? null;
    const stylesheet = stylesheetId
      ? diagram.document.styles.getNodeStyle(stylesheetId)
      : undefined;
    const stylesheetName = stylesheet?.name ?? 'No stylesheet';

    // Check if dirty
    const isDirty = stylesheet ? checkStyleDirty(node, stylesheet) : false;

    if (!styleMap.has(styleHash)) {
      // Create preview diagram (cached)
      let preview = PREVIEW_CACHE.get(styleHash);
      if (!preview) {
        preview = createPreviewDiagram(appearanceProps, diagram.document.definitions);
        PREVIEW_CACHE.set(styleHash, preview);
      }

      styleMap.set(styleHash, {
        styleHash,
        elements: [],
        count: 0,
        previewDiagram: preview.diagram,
        previewNode: preview.node,
        stylesheetId,
        stylesheetName,
        isDirty,
        sampleProps: appearanceProps
      });
    }

    const combo = styleMap.get(styleHash)!;
    combo.elements.push(node);
    combo.count++;
  }

  // Group by stylesheet
  const groupMap = new Map<string | null, StylesheetGroup>();
  for (const style of styleMap.values()) {
    const key = style.stylesheetId;
    if (!groupMap.has(key)) {
      const stylesheet = key ? diagram.document.styles.getNodeStyle(key) : undefined;
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

  // Sort groups: named stylesheets first (alphabetically), then "No stylesheet"
  const groups = Array.from(groupMap.values());
  return groups.sort((a, b) => {
    if (a.stylesheetId === null) return 1;
    if (b.stylesheetId === null) return -1;
    return a.stylesheetName.localeCompare(b.stylesheetName);
  });
};
