import { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import type { DiagramElement, ElementPropsForRendering } from '@diagram-craft/model/diagramElement';
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
import { unique } from '@diagram-craft/utils/array';
import { DynamicAccessor, type PropPath } from '@diagram-craft/utils/propertyPath';

export type StyleFilterType = 'all' | 'fill' | 'stroke' | 'shadow' | 'effects' | 'text';

export type StyleCombination = {
  stylesheet: Stylesheet<'node'> | Stylesheet<'edge'> | undefined;
  elements: DiagramElement[];
  previewDiagram?: Diagram;
  previewElement?: DiagramNode | DiagramEdge;
  differences: string[];
  propsDifferences: Partial<ElementProps>;
  props: ElementPropsForRendering;
};

export type TextStyleCombination = {
  elements: DiagramElement[];
  stylesheet: Stylesheet<'text'> | undefined;
  differences: string[];
  propsDifferences: Partial<ElementProps>;
  props: NodePropsForRendering;
};

export type StylesheetGroup<T> = {
  stylesheet: Stylesheet<'node'> | Stylesheet<'edge'> | Stylesheet<'text'> | undefined;
  styles: T[];
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

const createPreview = (props: Partial<ElementProps>, type: string, defs: Definitions) => {
  if (type === 'edge') {
    const { diagram, edge } = createThumbnailDiagramForEdge((_: Diagram, layer: RegularLayer) => {
      return ElementFactory.edge(
        newid(),
        new FreeEndpoint({ x: 5, y: 25 }),
        new FreeEndpoint({
          x: 45,
          y: 25
        }),
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
        {
          x: 5,
          y: 5,
          w: 40,
          h: 40,
          r: 0
        },
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

const sortGroups = <T>(groups: StylesheetGroup<T>[]) =>
  groups.sort((a, b) => {
    // Groups without stylesheet or with null id go to the end
    if (!a.stylesheet || a.stylesheet.id === null) return 1;
    if (!b.stylesheet || b.stylesheet.id === null) return -1;
    return a.stylesheet.name.localeCompare(b.stylesheet.name);
  });

export const collectTextStyles = (
  diagram: Diagram,
  elements: DiagramElement[]
): StylesheetGroup<TextStyleCombination>[] => {
  const styleMap = new Map<string, TextStyleCombination>();

  const nodes = elements.filter(isNode);
  for (const node of nodes) {
    const text = node.getText();
    if (isEmptyString(text)) continue;

    const props = extractPropsToConsider(node, 'text');

    // Get text stylesheet info
    const stylesheetId = node.metadata.textStyle ?? undefined;
    const stylesheet = diagram.document.styles.getTextStyle(stylesheetId);

    const { differences, propsDifferences } = computeStyleDifferences(
      props,
      stylesheet?.props,
      isNode(node)
    );

    const key = `${differences.join('|')}|${stylesheetId}`;

    if (!styleMap.has(key)) {
      styleMap.set(key, {
        stylesheet,
        differences,
        propsDifferences,
        props: node.renderProps,
        elements: []
      });
    }

    styleMap.get(key)!.elements.push(node);
  }

  // Group by stylesheet
  const groupMap = new Map<string | undefined, StylesheetGroup<TextStyleCombination>>();
  for (const textStyle of styleMap.values()) {
    const key = textStyle.stylesheet?.id;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        stylesheet: textStyle.stylesheet,
        styles: [
          {
            elements: [],
            stylesheet: textStyle.stylesheet,
            differences: [],
            propsDifferences: {},
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

  return sortGroups(Array.from(groupMap.values()));
};

export const collectStyles = (
  diagram: Diagram,
  elements: DiagramElement[],
  filterType: StyleFilterType = 'all'
): StylesheetGroup<StyleCombination>[] => {
  const styleMap = new Map<string, StyleCombination>();

  for (const element of elements) {
    const props = extractPropsToConsider(element, filterType);

    const stylesheetId = element.metadata.style ?? undefined;
    const stylesheet = diagram.document.styles.getStyle(stylesheetId) as
      | Stylesheet<'node'>
      | Stylesheet<'edge'>
      | undefined;

    const { differences, propsDifferences } = computeStyleDifferences(
      props,
      stylesheet?.props,
      isNode(element)
    );

    const key = `${differences.join('|')}|${stylesheetId}`;

    if (!styleMap.has(key)) {
      styleMap.set(key, {
        stylesheet,
        differences,
        propsDifferences,
        props: element.renderProps,
        elements: []
      });
    }

    styleMap.get(key)!.elements.push(element);
  }

  // Generate previews
  for (const [key, combo] of styleMap.entries()) {
    const nodeTypes = unique(combo.elements.filter(e => isNode(e)).map(el => el.nodeType));

    const nodeType = nodeTypes.length === 1 ? nodeTypes[0]! : 'rect';

    const cacheKey = `${key}-${nodeType}`;
    let preview = PREVIEW_CACHE.get(cacheKey);
    if (!preview) {
      preview = createPreview(combo.props, nodeType, diagram.document.definitions);
      PREVIEW_CACHE.set(cacheKey, preview);
    }

    combo.previewDiagram = preview.diagram;
    combo.previewElement = preview.element;
  }

  // Group by stylesheet
  const groupMap = new Map<string | undefined, StylesheetGroup<StyleCombination>>();
  for (const style of styleMap.values()) {
    const key = style.stylesheet?.id;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        stylesheet: style.stylesheet,
        styles: [
          {
            elements: [],
            stylesheet: style.stylesheet,
            differences: [],
            propsDifferences: {},
            props: style.props
          }
        ],
        totalElements: 0
      });
    }

    const group = groupMap.get(key)!;
    if (style.differences.length === 0) {
      group.styles[0] = style;
    } else {
      group.styles.push(style);
    }
    group.totalElements += style.elements.length;
  }

  return sortGroups(Array.from(groupMap.values()));
};

/**
 * Compute the differences between element props and the merged default + stylesheet props
 * Returns an array of formatted strings like "text.fontSize = 14" or "fill.color = #ff0000"
 *
 * @param elementProps - The element's appearance props (extracted)
 * @param stylesheetProps - The stylesheet's props (optional)
 * @param isNodeStyle - Whether this is a node style (true) or edge style (false)
 */
const computeStyleDifferences = (
  elementProps: Partial<NodeProps | EdgeProps>,
  stylesheetProps: Partial<NodeProps | EdgeProps> | undefined,
  isNodeStyle: boolean
): { differences: string[]; propsDifferences: Partial<ElementProps> } => {
  if (!stylesheetProps) {
    return { differences: [], propsDifferences: {} };
  }

  // Get default props and merge with stylesheet props based on element type
  const mergedStylesheetProps = isNodeStyle
    ? deepMerge({}, nodeDefaults.applyDefaults({}), stylesheetProps as Partial<NodeProps>)
    : deepMerge({}, edgeDefaults.applyDefaults({}), stylesheetProps as Partial<EdgeProps>);

  const differences: string[] = [];
  const propsDifferences: Partial<ElementProps> = {};

  const props = new DynamicAccessor<Partial<ElementProps>>();

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
      props.set(propsDifferences, path as PropPath<ElementProps>, elementValue);
    }
  };

  // Compare all top-level properties
  for (const key of Object.keys(elementProps)) {
    const mergedValue = (mergedStylesheetProps as Record<string, unknown>)[key];
    const elementValue = (elementProps as Record<string, unknown>)[key];
    compareProps(mergedValue, elementValue, key);
  }

  return { differences, propsDifferences };
};

export const _test = {
  computeStyleDifferences,
  sortGroups,
  extractPropsToConsider
};
