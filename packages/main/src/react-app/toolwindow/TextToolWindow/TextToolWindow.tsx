import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './TextToolWindow.module.css';
import { useDiagram } from '../../../application';
import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import { useEventListener } from '../../hooks/useEventListener';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCheck, TbRestore } from 'react-icons/tb';

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

const applySyntaxHighlighting = (lines: string[], errors: Array<string | undefined>) => {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const error = errors[i];

    let dest = line;
    dest = dest.replaceAll(/("[^"]+")/g, '<span class="syntax-string">$1</span>');
    dest = dest.replaceAll(/^(\s*props):/g, '<span class="syntax-props">$1</span>:');
    dest = dest.replaceAll(/^(\s*[^:]+):/g, '<span class="syntax-label">$1</span>:');
    dest = dest.replaceAll(/({|})/g, '<span class="syntax-bracket">$1</span>');

    if (error) {
      dest = `<span class="syntax-error">${dest}</span>`;
    }

    result.push(dest);
  }

  return result;
};

export const TextToolWindow = () => {
  const diagram = useDiagram();
  const [lines, setLines] = useState<string[]>([]);
  const [errors, setErrors] = useState<Array<string | undefined>>([]);
  const [dirty, setDirty] = useState(false);

  const codeElementRef = useRef<HTMLElement>(null);
  const preElementRef = useRef<HTMLPreElement>(null);

  const parseTimer = useRef<ReturnType<typeof setTimeout>>();

  const parse = useCallback((lines: string[]) => {
    //setLines([]);
    setErrors([undefined, 'Error', undefined]);
  }, []);

  const updateLines = useCallback(() => {
    const layer = diagram.activeLayer;
    const newLines: string[] = [];
    if (isRegularLayer(layer)) {
      for (const element of layer.elements) {
        addElement(element, newLines);
        newLines.push('');
      }
    }
    setLines(newLines);
    setErrors([]);
    setDirty(false);
  }, [diagram]);

  useEffect(() => updateLines(), [updateLines]);

  useEventListener(diagram, 'diagramChange', updateLines);
  useEventListener(diagram.layers, 'layerStructureChange', updateLines);
  useEventListener(diagram, 'elementAdd', updateLines);
  useEventListener(diagram, 'elementChange', updateLines);
  useEventListener(diagram, 'elementRemove', updateLines);
  useEventListener(diagram, 'elementBatchChange', updateLines);

  const onChange = useCallback(
    (text: string) => {
      assert.present(codeElementRef.current);
      setDirty(true);
      const lines = text.split('\n');
      setLines(lines);

      if (parseTimer.current) {
        clearTimeout(parseTimer.current);
      }
      parseTimer.current = setTimeout(() => parse(lines), 500);
    },
    [parse]
  );

  const onKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();

        const $el = e.target as HTMLTextAreaElement;
        const text = $el.value;

        const before = text.slice(0, $el.selectionStart);
        const after = text.slice($el.selectionEnd, $el.value.length);
        const pos = $el.selectionEnd + 1;
        $el.value = `${before}  ${after}`;
        $el.selectionStart = pos;
        $el.selectionEnd = pos;

        onChange($el.value);
      }
    },
    [onChange]
  );

  const onScroll = useCallback((source: HTMLElement) => {
    assert.present(preElementRef.current);
    preElementRef.current.scrollTop = source.scrollTop;
    preElementRef.current.scrollLeft = source.scrollLeft;
  }, []);

  return (
    <ToolWindow.Root id={'text'} defaultTab={'text'}>
      <ToolWindow.Tab id={'text'} title={'Text'}>
        <ToolWindow.TabActions>
          <Button type={'icon-only'} disabled={!dirty} onClick={() => updateLines()}>
            <TbRestore />
          </Button>
          <Button type={'icon-only'} disabled={!dirty}>
            <TbCheck />
          </Button>
        </ToolWindow.TabActions>
        <ToolWindow.TabContent>
          <ToolWindowPanel
            mode={'headless-no-padding'}
            id={'text'}
            title={'Text'}
            // @ts-ignore
            style={{ anchorName: '--content' }}
          >
            <div className={styles.textEditorContainer}>
              <textarea
                spellCheck={false}
                onKeyDown={e => onKeydown(e)}
                onInput={e => {
                  onChange((e.target as HTMLTextAreaElement).value);
                  onScroll(e.target as HTMLElement);
                }}
                onScroll={e => onScroll(e.target as HTMLElement)}
                value={lines.join('\n')}
              />

              <pre className={styles.textEditor} ref={preElementRef}>
                <code
                  ref={codeElementRef}
                  dangerouslySetInnerHTML={{
                    __html: applySyntaxHighlighting(lines, errors).join('\n')
                  }}
                />
              </pre>
            </div>
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
