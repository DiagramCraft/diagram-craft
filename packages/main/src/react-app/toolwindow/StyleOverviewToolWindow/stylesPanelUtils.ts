import { Diagram } from '@diagram-craft/model/diagram';
import type { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import type { DiagramElement, ElementPropsForRendering } from '@diagram-craft/model/diagramElement';
import { isNode } from '@diagram-craft/model/diagramElement';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import {
  EdgeStylesheet,
  NodeStylesheet,
  Stylesheet,
  TextStylesheet
} from '@diagram-craft/model/diagramStyles';
import { type EdgeProps, type ElementProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { edgeDefaults, nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { deepMerge } from '@diagram-craft/utils/object';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { unique } from '@diagram-craft/utils/array';
import { DynamicAccessor } from '@diagram-craft/utils/propertyPath';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export type StyleFilterType = 'all' | 'fill' | 'stroke' | 'shadow' | 'effects' | 'text';

export type StyleCombination = {
  stylesheet: NodeStylesheet | EdgeStylesheet | undefined;
  elements: DiagramElement[];
  previewDiagram?: Diagram;
  previewElement?: DiagramElement;
  differences: string[];
  propsDifferences: Partial<ElementProps>;
  props: ElementPropsForRendering;
};

export type TextStyleCombination = {
  elements: DiagramElement[];
  stylesheet: TextStylesheet | undefined;
  differences: string[];
  propsDifferences: Partial<ElementProps>;
  props: NodePropsForRendering;
};

export type StylesheetGroup<T> = {
  stylesheet: Stylesheet | undefined;
  styles: T[];
  totalElements: number;
};

export const extractPropsToConsider = (
  props: Partial<ElementProps>,
  filter: StyleFilterType,
  isNode: boolean
): Partial<NodeProps | EdgeProps> => {
  switch (filter) {
    case 'fill':
      if (isNode) {
        return { fill: props.fill };
      } else {
        return {};
      }
    case 'stroke':
      if (isNode) {
        return { stroke: props.stroke };
      } else {
        return {
          stroke: props.stroke,
          arrow: (props as Partial<EdgeProps>).arrow
        };
      }
    case 'shadow':
      return { shadow: props.shadow };
    case 'effects':
      return { effects: props.effects };
    case 'text':
      if (isNode) {
        return { text: (props as Partial<NodeProps>).text };
      } else {
        return {};
      }

    default:
      if (isNode) {
        return {
          fill: props.fill,
          stroke: props.stroke,
          shadow: props.shadow,
          effects: props.effects,
          text: (props as Partial<NodeProps>).text,
          geometry: props.geometry
        };
      } else {
        return {
          stroke: props.stroke,
          shadow: props.shadow,
          effects: props.effects,
          arrow: (props as Partial<EdgeProps>).arrow
        };
      }
  }
};

export const createPreview = (
  props: Partial<ElementProps>,
  type: string,
  nodeType: string,
  defs: Registry
) => {
  const { diagram, elements } = createThumbnail((diagram: Diagram, layer: RegularLayer) => {
    const elements: DiagramElement[] = [];
    if (type === 'edge') {
      elements.push(
        ElementFactory.edge(
          newid(),
          new FreeEndpoint({ x: 5, y: 25 }),
          new FreeEndpoint({ x: 45, y: 25 }),
          props as Partial<EdgeProps>,
          {},
          [],
          layer
        )
      );
    } else {
      elements.push(
        ElementFactory.node(
          newid(),
          nodeType,
          { x: 5, y: 5, w: 40, h: 40, r: 0 },
          layer,
          props as Partial<NodeProps>,
          {}
        )
      );
    }

    UnitOfWork.execute(diagram, uow => elements.forEach(e => layer.addElement(e, uow)));

    return elements;
  }, defs);

  // Set viewBox to show the node with padding
  diagram.viewBox.dimensions = { w: 50, h: 50 };
  diagram.viewBox.offset = { x: 0, y: 0 };

  return { diagram: diagram, element: elements[0]! };
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

    const props = extractPropsToConsider(node.storedProps, 'text', isNode(node));

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
    const props = extractPropsToConsider(element.storedProps, filterType, isNode(element));

    const stylesheetId = element.metadata.style ?? undefined;
    const stylesheet = diagram.document.styles.getStyle(stylesheetId) as
      | NodeStylesheet
      | EdgeStylesheet
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
  for (const [_key, combo] of styleMap.entries()) {
    const nodeTypes = unique(combo.elements.filter(e => isNode(e)).map(el => el.nodeType));

    const nodeType = nodeTypes.length === 1 ? nodeTypes[0]! : 'rect';

    const preview = createPreview(
      combo.props,
      combo.elements[0]!.type,
      nodeType,
      diagram.document.registry
    );

    combo.previewDiagram = preview.diagram;
    combo.previewElement = preview.element;
  }

  // Group by stylesheet
  const groupMap = new Map<string | undefined, StylesheetGroup<StyleCombination>>();
  for (const style of styleMap.values()) {
    const key = style.stylesheet?.id;
    if (!groupMap.has(key)) {
      const preview = createPreview(
        style.stylesheet?.props ?? {},
        style.elements[0]!.type,
        'rect',
        diagram.document.registry
      );

      groupMap.set(key, {
        stylesheet: style.stylesheet,
        styles: [
          {
            elements: [],
            stylesheet: style.stylesheet,
            differences: [],
            propsDifferences: {},
            props: style.props,
            previewDiagram: preview.diagram,
            previewElement: preview.element
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

const formatDiff = (path: string, value: unknown): string => {
  return typeof value === 'object' && value !== null
    ? `${path} = ${JSON.stringify(value)}`
    : `${path} = ${value}`;
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
  if (!stylesheetProps) return { differences: [], propsDifferences: {} };

  // Get default props and merge with stylesheet props based on element type
  const stylePropsToUse = isNodeStyle
    ? deepMerge({}, nodeDefaults.applyDefaults({}), stylesheetProps as Partial<NodeProps>)
    : deepMerge({}, edgeDefaults.applyDefaults({}), stylesheetProps as Partial<EdgeProps>);

  const differences: string[] = [];
  const propsDifferences: Partial<ElementProps> = {};

  const accessor = new DynamicAccessor<Partial<ElementProps>>();

  const paths = accessor.paths(elementProps);

  // Compare each path
  for (const path of paths) {
    const elementValue = accessor.get(elementProps, path);
    const stylesheetValue = accessor.get(stylePropsToUse, path);

    if (elementValue === undefined) continue;

    // Only compare leaf values (non-objects)
    if (typeof elementValue !== 'object' || elementValue === null || Array.isArray(elementValue)) {
      if (JSON.stringify(stylesheetValue) !== JSON.stringify(elementValue)) {
        differences.push(formatDiff(path, elementValue));
        accessor.set(propsDifferences, path, elementValue);
      }
    }
  }

  return { differences, propsDifferences };
};

export const _test = {
  computeStyleDifferences,
  sortGroups
};
