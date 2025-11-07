import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import type { DiagramSerializer } from '../../types';
import { propsToArrowNotation } from './arrowNotation';

type ElementMetadata = {
  name?: string;
  style?: string;
  textStyle?: string;
};

// biome-ignore lint/suspicious/noExplicitAny: this needs to handle both NodeProps and EdgeProps
type ElementProps = any;

const needsQuotes = (id: string) => id.includes(' ');

const formatId = (id: string) => (needsQuotes(id) ? `"${id}"` : id);

const serializeMetadata = (data: ElementMetadata | undefined) => {
  if (!data) return undefined;
  if (data.name) return `name=${data.name}`;
  return undefined;
};

const serializeProps = (data: ElementProps | undefined) => {
  if (!data) return undefined;

  // biome-ignore lint/suspicious/noExplicitAny: this is a valid use of any
  const collect = (obj: any, prefix = '') => {
    const result: string[] = [];
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        result.push(...collect(value, `${prefix}${key}.`));
      } else {
        result.push(`${prefix}${key}=${value}`);
      }
    }
    return result;
  };

  const res = collect(data);
  if (res.length === 0) return undefined;
  return res.join(';');
};

const elementToText = (element: DiagramElement, lines: string[], indent = '') => {
  if (isNode(element)) {
    let node = indent;
    node += `${formatId(element.id)}:`;
    node += ` ${element.nodeType}`;

    if (element.texts.text) {
      node += ` "${element.texts.text}"`;
    }

    const sublines: string[] = [];

    for (const child of element.children) {
      elementToText(child, sublines, `${indent}  `);
    }

    const metadataCloned = element.metadataCloned;
    const propsCloned = element.storedPropsCloned;

    let style = metadataCloned.style;
    let textStyle = metadataCloned.textStyle;
    if (style === 'default' || style === 'default-text') style = undefined;
    if (textStyle === 'default-text-default') textStyle = undefined;

    if (style || textStyle) {
      sublines.push(
        `${indent}  stylesheet: ${[style ? `${style} ` : '', textStyle ? ` ${textStyle}` : ''].join('/')}`
      );
    }

    const propsS = serializeProps(propsCloned);
    if (propsS) {
      sublines.push(`${indent}  props: "${propsS}"`);
    }

    const metadataS = serializeMetadata(metadataCloned);
    if (metadataS) {
      sublines.push(`${indent}  metadata: "${metadataS}"`);
    }

    if (sublines.length > 0) {
      lines.push(`${node} {`);
      lines.push(...sublines);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${node}`);
    }
  } else if (isEdge(element)) {
    let edge = indent;
    edge += `${formatId(element.id)}: edge`;

    // Try to generate arrow notation from edge props
    const propsCloned = element.storedPropsCloned;
    let arrowNotation: string | undefined = undefined;
    let propsWithoutArrow: ElementProps = propsCloned;

    if (propsCloned) {
      arrowNotation = propsToArrowNotation(propsCloned as EdgeProps);

      if (arrowNotation) {
        // Remove arrow and stroke properties from props since they're in the notation
        // biome-ignore lint/suspicious/noExplicitAny: this needs to be any
        const cloned: any = { ...propsCloned };
        delete cloned.arrow;
        if (propsCloned.stroke) {
          const { ...remainingStroke } = propsCloned.stroke;
          if (Object.keys(remainingStroke).length === 0) {
            delete cloned.stroke;
          } else {
            cloned.stroke = remainingStroke;
          }
        }
        propsWithoutArrow = cloned;
      }
    }

    // Fall back to default notation if no match
    const notation = arrowNotation ?? '--';

    if (element.start.isConnected || element.end.isConnected) {
      if (element.start.isConnected) {
        edge += ` ${formatId((element.start as ConnectedEndpoint).node.id)}`;
      }
      edge += ` ${notation} `;
      if (element.end.isConnected) {
        edge += formatId((element.end as ConnectedEndpoint).node.id);
      }
    }

    const hasSingleLabelNode = element.labelNodes.length === 1;
    if (hasSingleLabelNode) {
      edge += ` "${element.labelNodes[0]!.node().texts.text}"`;
    }

    const sublines: string[] = [];

    // When there's a single label node, don't serialize it as a child since it's shown inline
    const labelNodeId = hasSingleLabelNode ? element.labelNodes[0]!.node().id : null;
    for (const child of element.children) {
      if (child.id !== labelNodeId) {
        elementToText(child, sublines, `${indent}  `);
      }
    }

    const propsS = serializeProps(propsWithoutArrow);
    if (propsS) {
      sublines.push(`${indent}  props: "${propsS}"`);
    }

    if (sublines.length > 0) {
      lines.push(`${edge} {`);
      lines.push(...sublines);
      lines.push(`${indent}}`);
    } else {
      lines.push(`${edge}`);
    }
  }
};

/**
 * Default format serializer implementation
 */
export const defaultSerializer: DiagramSerializer = {
  serialize(layer: RegularLayer): string[] {
    const newLines: string[] = [];
    for (const element of layer.elements) {
      elementToText(element, newLines);
      newLines.push('');
    }
    return newLines;
  }
};
