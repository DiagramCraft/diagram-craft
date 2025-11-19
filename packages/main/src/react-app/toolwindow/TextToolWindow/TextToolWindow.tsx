import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './TextToolWindow.module.css';
import { useDiagram } from '../../../application';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCheck, TbRestore } from 'react-icons/tb';
import { type ParseErrors } from '@diagram-craft/canvas-app/text-to-diagram/types';
import { textToDiagram } from '@diagram-craft/canvas-app/text-to-diagram/textToDiagram';
import { FormatRegistry } from '@diagram-craft/canvas-app/text-to-diagram/registry';
import { SyntaxHighlightingEditor } from '@diagram-craft/app-components/SyntaxHighlightingEditor';

export const TextToolWindow = () => {
  const diagram = useDiagram();
  const [text, setText] = useState<string>('');
  const [errors, setErrors] = useState<ParseErrors>(new Map<number, string>());
  const [dirty, setDirty] = useState(false);

  const parseTimer = useRef<ReturnType<typeof setTimeout>>();
  const format = FormatRegistry['default'];

  const parseText = useCallback(
    (text: string) => {
      if (!format) throw new Error('Default format not found');
      const result = format.parser.parse(text);
      setErrors(result.errors);
    },
    [format]
  );

  const updateText = useCallback(() => {
    const layer = diagram.activeLayer;
    if (!format) throw new Error('Default format not found');
    const lines = isRegularLayer(layer) ? format.serializer.serialize(layer) : [];
    setText(lines.join('\n'));
    setErrors(new Map<number, string>());
    setDirty(false);
  }, [diagram, format]);

  useEffect(() => updateText(), [updateText]);

  useEventListener(diagram, 'diagramChange', updateText);
  useEventListener(diagram.layers, 'layerStructureChange', updateText);
  useEventListener(diagram, 'elementAdd', updateText);
  useEventListener(diagram, 'elementChange', updateText);
  useEventListener(diagram, 'elementRemove', updateText);
  useEventListener(diagram, 'elementBatchChange', updateText);

  const applyChanges = useCallback(() => {
    if (!format) throw new Error('Default format not found');
    const result = format.parser.parse(text);
    if (result.errors.size > 0) {
      setErrors(result.errors);
      return;
    }

    textToDiagram(result.elements, diagram);

    updateText();
  }, [diagram, text, updateText, format]);

  const onChange = useCallback(
    (value: string) => {
      setDirty(true);
      setText(value);

      if (parseTimer.current) {
        clearTimeout(parseTimer.current);
      }
      parseTimer.current = setTimeout(() => parseText(value), 500);
    },
    [parseText]
  );

  const highlighter = useCallback(
    (lines: string[]) => {
      if (!format?.syntaxHighlighter) return lines;
      return format.syntaxHighlighter.highlight(lines);
    },
    [format]
  );

  return (
    <ToolWindow.Root id={'text'} defaultTab={'text'}>
      <ToolWindow.Tab
        id={'text'}
        title={'Text'}
        indicator={dirty ? <div className={styles.textEditorDirtyIndicator} /> : null}
      >
        <ToolWindow.TabActions>
          <Button type={'icon-only'} disabled={!dirty} onClick={() => updateText()}>
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
            // @ts-expect-error - anchorName is a new CSS property
            style={{ anchorName: '--content' }}
          >
            <SyntaxHighlightingEditor
              value={text}
              onChange={onChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  applyChanges();
                }
              }}
              highlighter={highlighter}
              errors={errors}
              className={styles.textEditorContainer}
            />
          </ToolWindowPanel>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
