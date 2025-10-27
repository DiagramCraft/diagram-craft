import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './TextToolWindow.module.css';
import { useDiagram } from '../../../application';
import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';

const serializeMetadata = (data: ElementMetadata | undefined) => {
  if (!data) return undefined;
  if (data.name) return `name=${data.name}`;
  return undefined;
};

const serializeProps = (data: ElementProps | undefined) => {
  if (!data) return undefined;

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

const addElement = (element: DiagramElement, lines: string[], indent = '') => {
  if (isNode(element)) {
    let node = indent;
    node += `${element.id}:`;
    node += ` ${element.nodeType}`;

    if (element.texts.text) {
      node += ` "${element.texts.text}"`;
    }

    const sublines: string[] = [];

    for (const child of element.children) {
      addElement(child, sublines, `${indent}  `);
    }

    const metadataCloned = element.metadataCloned;
    const propsCloned = element.storedPropsCloned;

    let style = metadataCloned.style;
    let textStyle = metadataCloned.textStyle;
    if (style === 'default' || style === 'default-text') style = undefined;
    if (textStyle === 'default-text-default') textStyle = undefined;

    if (style || textStyle) {
      sublines.push(
        `${indent}  styleheet: ${[style ? `${style} ` : '', textStyle ? ` ${textStyle}` : ''].join('/')}`
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
    edge += `${element.id}: edge`;

    if (element.start.isConnected || element.end.isConnected) {
      if (element.start.isConnected) {
        edge += ` ${(element.start as ConnectedEndpoint).node.id}`;
      }
      edge += ' -> ';
      if (element.end.isConnected) {
        edge += `${(element.end as ConnectedEndpoint).node.id}`;
      }
    }

    if (element.labelNodes.length === 1) {
      edge += ` "${element.labelNodes[0]!.node().texts.text}"`;
    }

    const sublines: string[] = [];
    const propsCloned = element.storedPropsCloned;

    for (const child of element.children) {
      addElement(child, sublines, `${indent}  `);
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

export const TextToolWindow = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();

  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementChange', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'elementBatchChange', redraw);

  const layer = diagram.activeLayer;

  const lines: string[] = [];
  if (isRegularLayer(layer)) {
    for (const element of layer.elements) {
      addElement(element, lines);
      lines.push('');
    }
  }

  return (
    <ToolWindow.Root id={'text'} defaultTab={'text'}>
      <ToolWindow.Tab id={'text'} title={'Text'}>
        {/*
        <ToolWindow.TabActions>
          <Button type={'secondary'}>
            <TbRefresh />
            &nbsp; Apply
          </Button>
        </ToolWindow.TabActions>
        */}
        <ToolWindow.TabContent>
          <ToolWindowPanel mode={'headless-no-padding'} id={'text'} title={'Text'}>
            <pre className={styles.textEditor}>
              <code>{lines.join('\n')}</code>
            </pre>
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
