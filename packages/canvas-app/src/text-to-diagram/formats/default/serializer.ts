import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { NodeConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import type { DiagramSerializer } from '../../types';
import { propsToArrowNotation } from './arrowNotation';
import { deepClone } from '@diagram-craft/utils/object';
import type { DeepWriteable } from '@diagram-craft/utils/types';
import type { EdgeProps } from '@diagram-craft/model/diagramProps';

type ElementMetadata = {
  name?: string;
  style?: string;
  textStyle?: string;
};

// biome-ignore lint/suspicious/noExplicitAny: this needs to handle both NodeProps and EdgeProps
type ElementProps = any;

const escapeString = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
const escapeValue = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll('=', '\\=');

const needsQuotes = (id: string) => !/^[a-zA-Z0-9_-]+$/.test(id);

const formatString = (value: string) => `"${escapeString(value)}"`;

const formatId = (id: string) => (needsQuotes(id) ? formatString(id) : id);

const serializeMetadata = (data: ElementMetadata | undefined) => {
  if (!data) return undefined;
  const result: string[] = [];
  if (data.name) {
    result.push(`name=${escapeValue(data.name)}`);
  }
  return result.length > 0 ? result.join(';') : undefined;
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
        result.push(`${prefix}${key}=${escapeValue(String(value))}`);
      }
    }
    return result;
  };

  const res = collect(data);
  if (res.length === 0) return undefined;
  return res.join(';');
};

const getSerializedStyles = (metadata: ElementMetadata) => {
  let style = metadata.style;
  let textStyle = metadata.textStyle;
  if (style === 'default' || style === 'default-text' || style === 'default-edge') style = undefined;
  if (textStyle === 'default-text-default') textStyle = undefined;
  return { style, textStyle };
};

const appendMetadataSublines = (
  sublines: string[],
  metadata: ElementMetadata,
  props: ElementProps | undefined,
  indent: string
) => {
  const { style, textStyle } = getSerializedStyles(metadata);

  if (style || textStyle) {
    sublines.push(
      `${indent}  stylesheet: ${[style ? `${style} ` : '', textStyle ? ` ${textStyle}` : ''].join('/')}`
    );
  }

  const propsS = serializeProps(props);
  if (propsS) {
    sublines.push(`${indent}  props: ${formatString(propsS)}`);
  }

  const metadataS = serializeMetadata(metadata);
  if (metadataS) {
    sublines.push(`${indent}  metadata: ${formatString(metadataS)}`);
  }
};

const elementToText = (element: DiagramElement, lines: string[], indent = '') => {
  if (isNode(element)) {
    let node = indent;
    node += `${formatId(element.id)}:`;
    node += ` ${element.nodeType}`;

    if (element.texts.text) {
      node += ` ${formatString(element.texts.text)}`;
    }

    const sublines: string[] = [];

    for (const child of element.children) {
      elementToText(child, sublines, `${indent}  `);
    }

    appendMetadataSublines(sublines, element.metadata, element.storedProps, indent);

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
    const propsCloned = deepClone(element.storedProps);
    let arrowNotation: string | undefined;
    let propsWithoutArrow: ElementProps = propsCloned;

    if (propsCloned) {
      arrowNotation = propsToArrowNotation(propsCloned as EdgeProps);

      if (arrowNotation) {
        // Remove arrow and stroke properties from props since they're in the notation
        const cloned = deepClone(propsCloned) as DeepWriteable<EdgeProps>;
        delete cloned.arrow;
        if (cloned.stroke && Object.keys(cloned.stroke).length === 0) {
          delete cloned.stroke;
        }
        propsWithoutArrow = cloned;
      }
    }

    // Fall back to default notation if no match
    const notation = arrowNotation ?? '--';

    const startNode =
      element.start instanceof NodeConnectedEndpoint ? element.start.node : undefined;
    const endNode = element.end instanceof NodeConnectedEndpoint ? element.end.node : undefined;

    if (startNode || endNode) {
      if (startNode) {
        edge += ` ${formatId(startNode.id)}`;
      }
      edge += ` ${notation} `;
      if (endNode) {
        edge += formatId(endNode.id);
      }
    }

    const hasSingleLabelNode = element.labelNodes.length === 1;
    if (hasSingleLabelNode) {
      edge += ` ${formatString(element.labelNodes[0]!.node().texts.text)}`;
    }

    const sublines: string[] = [];

    // When there's a single label node, don't serialize it as a child since it's shown inline
    const labelNodeId = hasSingleLabelNode ? element.labelNodes[0]!.node().id : null;
    for (const child of element.children) {
      if (child.id !== labelNodeId) {
        elementToText(child, sublines, `${indent}  `);
      }
    }

    appendMetadataSublines(sublines, element.metadata, propsWithoutArrow, indent);

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
