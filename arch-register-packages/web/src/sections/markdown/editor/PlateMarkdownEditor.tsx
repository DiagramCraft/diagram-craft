import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Plate, PlateContent, usePlateEditor } from 'platejs/react';
import type { Value } from 'platejs';
import { deserializeMd, serializeMd } from '@platejs/markdown';
import { DndScroller } from '@platejs/dnd';
import { MdxBlockRegistryProvider } from './MdxBlockRegistryContext';
import { handleTableKeyDown } from './PlateMarkdownEditorTable';
import { FloatingToolbar } from './PlateMarkdownEditorToolbar';
import { editorPlugins } from './PlateMarkdownEditorPlugins';
import { MDX_COMPONENTS } from '../mdx-components/mdxRegistry';
import styles from './PlateMarkdownEditor.module.css';

interface PlateMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

export const PlateMarkdownEditor = ({ value, onChange }: PlateMarkdownEditorProps) => {
  const externalValueRef = useRef(value);

  const editor = usePlateEditor({
    plugins: editorPlugins,
    value: ed => deserializeMd(ed, value)
  });

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      handleTableKeyDown(editor, event);
    },
    [editor]
  );

  // Sync when an external change arrives (e.g. restore from revision history)
  useEffect(() => {
    if (value === externalValueRef.current) return;
    externalValueRef.current = value;
    editor.tf.setValue(deserializeMd(editor, value));
  }, [value, editor]);

  const handleChange = useCallback(
    ({ value: _editorValue }: { value: Value; editor: typeof editor }) => {
      const md = serializeMd(editor);
      externalValueRef.current = md;
      onChange(md);
    },
    [editor, onChange]
  );

  return (
    <MdxBlockRegistryProvider value={MDX_COMPONENTS}>
      <DndProvider backend={HTML5Backend}>
        <div className={styles.editor}>
          <Plate editor={editor} onChange={handleChange}>
            <PlateContent
              className={styles.plateContent}
              placeholder="Start writing, or type / for commands…"
              spellCheck
              onKeyDown={onKeyDown}
            />
            <FloatingToolbar />
            <DndScroller />
          </Plate>
        </div>
      </DndProvider>
    </MdxBlockRegistryProvider>
  );
};
