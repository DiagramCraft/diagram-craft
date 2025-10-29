import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

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

    if (element.start.isConnected || element.end.isConnected) {
      if (element.start.isConnected) {
        edge += ` ${formatId((element.start as ConnectedEndpoint).node.id)}`;
      }
      edge += ' -> ';
      if (element.end.isConnected) {
        edge += formatId((element.end as ConnectedEndpoint).node.id);
      }
    }

    const hasSingleLabelNode = element.labelNodes.length === 1;
    if (hasSingleLabelNode) {
      edge += ` "${element.labelNodes[0]!.node().texts.text}"`;
    }

    const sublines: string[] = [];
    const propsCloned = element.storedPropsCloned;

    // When there's a single label node, don't serialize it as a child since it's shown inline
    const labelNodeId = hasSingleLabelNode ? element.labelNodes[0]!.node().id : null;
    for (const child of element.children) {
      if (child.id !== labelNodeId) {
        elementToText(child, sublines, `${indent}  `);
      }
    }

    const propsS = serializeProps(propsCloned);
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

export const diagramToText = (layer: RegularLayer) => {
  const newLines: string[] = [];
  for (const element of layer.elements) {
    elementToText(element, newLines);
    newLines.push('');
  }
  return newLines;
};
