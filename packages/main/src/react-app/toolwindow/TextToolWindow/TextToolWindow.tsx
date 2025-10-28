import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './TextToolWindow.module.css';
import { useDiagram } from '../../../application';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { useEventListener } from '../../hooks/useEventListener';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCheck, TbRestore } from 'react-icons/tb';
import { parse, type ParseErrors } from '@diagram-craft/canvas-app/text-to-diagram/parser';
import { textToDiagram } from '@diagram-craft/canvas-app/text-to-diagram/textToDiagram';
import { diagramToText } from '@diagram-craft/canvas-app/text-to-diagram/diagramToText';
import { applySyntaxHighlighting } from '@diagram-craft/canvas-app/text-to-diagram/syntaxHighlighter';

export const TextToolWindow = () => {
  const diagram = useDiagram();
  const [lines, setLines] = useState<string[]>([]);
  const [errors, setErrors] = useState<ParseErrors>(new Map<number, string>());
  const [dirty, setDirty] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; message: string } | null>(null);

  const codeElementRef = useRef<HTMLElement>(null);
  const preElementRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parseTimer = useRef<ReturnType<typeof setTimeout>>();

  const parseText = useCallback((lines: string[]) => {
    const text = lines.join('\n');
    const result = parse(text);
    setErrors(result.errors);
  }, []);

  const updateLines = useCallback(() => {
    const layer = diagram.activeLayer;
    const newLines = isRegularLayer(layer) ? diagramToText(layer) : [];
    setLines(newLines);
    setErrors(new Map<number, string>());
    setDirty(false);
  }, [diagram]);

  useEffect(() => updateLines(), [updateLines]);

  useEventListener(diagram, 'diagramChange', updateLines);
  useEventListener(diagram.layers, 'layerStructureChange', updateLines);
  useEventListener(diagram, 'elementAdd', updateLines);
  useEventListener(diagram, 'elementChange', updateLines);
  useEventListener(diagram, 'elementRemove', updateLines);
  useEventListener(diagram, 'elementBatchChange', updateLines);

  const applyChanges = useCallback(() => {
    const text = lines.join('\n');
    const result = parse(text);
    if (result.errors.size > 0) {
      setErrors(result.errors);
      return;
    }

    textToDiagram(result.elements, diagram);

    updateLines();
  }, [diagram, lines, updateLines]);

  const onChange = useCallback(
    (text: string) => {
      assert.present(codeElementRef.current);
      setDirty(true);
      const lines = text.split('\n');
      setLines(lines);

      if (parseTimer.current) {
        clearTimeout(parseTimer.current);
      }
      parseTimer.current = setTimeout(() => parseText(lines), 500);
    },
    [parseText]
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

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const rect = textarea.getBoundingClientRect();

      // Calculate which line the mouse is over based on line height
      const padding = 10; // matches CSS: padding: 10px;
      const lineHeight = 15; // matches CSS: 11px / 15px monospace
      const scrollTop = textarea.scrollTop;
      const mouseY = e.clientY - rect.top - padding + scrollTop;
      const lineIndex = Math.floor(mouseY / lineHeight);

      // Check if there's an error on this line
      if (lineIndex >= 0 && lineIndex < errors.size && errors.has(lineIndex)) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          message: errors.get(lineIndex)!
        });
      } else {
        setTooltip(null);
      }
    },
    [errors]
  );

  const onMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <ToolWindow.Root id={'text'} defaultTab={'text'}>
      <ToolWindow.Tab
        id={'text'}
        title={'Text'}
        indicator={dirty ? <div className={styles.textEditorDirtyIndicator} /> : null}
      >
        <ToolWindow.TabActions>
          <Button type={'icon-only'} disabled={!dirty} onClick={() => updateLines()}>
            <TbRestore />
          </Button>
          <Button type={'icon-only'} disabled={!dirty} onClick={() => applyChanges()}>
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
                ref={textareaRef}
                spellCheck={false}
                onKeyDown={e => onKeydown(e)}
                onInput={e => {
                  onChange((e.target as HTMLTextAreaElement).value);
                  onScroll(e.target as HTMLElement);
                }}
                onScroll={e => onScroll(e.target as HTMLElement)}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
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

              {tooltip && (
                <div
                  className={styles.tooltip}
                  style={{ left: `${tooltip.x}px`, top: `${tooltip.y + 20}px` }}
                >
                  {tooltip.message}
                </div>
              )}
            </div>
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
