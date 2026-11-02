import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlateElement, createPlatePlugin, useEditorRef } from 'platejs/react';
import type { PlateElementProps } from 'platejs/react';
import type { TElement } from 'platejs';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useDocumentPickerSearch } from '../../../hooks/useDocuments';
import { WIKI_LINK_TYPE } from '../../../widgets/content-layout/wiki-link/WikiLinkEditable';
import { insertOrReplaceInline } from './PlateMarkdownEditorSlashCommands';
import styles from './PlateMarkdownEditor.module.css';

export const WIKI_LINK_INPUT_TYPE = 'wiki_link_input';

type PlateEditor = ReturnType<typeof useEditorRef>;

// Typing a second `[` directly after a `[` replaces both with a transient
// inline input node that hosts the page autocomplete.
export const handleWikiLinkTrigger = (
  editor: Pick<PlateEditor, 'selection' | 'api' | 'tf'>,
  text: string,
  options?: { at?: unknown }
): boolean => {
  if (text !== '[' || options?.at || !editor.selection) return false;
  if (editor.api.some({ match: n => (n as TElement).type === WIKI_LINK_INPUT_TYPE })) return false;
  // Not inside code
  if (editor.api.some({ match: n => (n as TElement).type === 'code_block' })) return false;

  const before = editor.api.string(editor.api.range('before', editor.selection)!);
  if (before !== '[') return false;

  editor.tf.deleteBackward('character');
  editor.tf.insertNodes({ type: WIKI_LINK_INPUT_TYPE, children: [{ text: '' }] });
  return true;
};

export const WikiLinkTriggerPlugin = createPlatePlugin({
  key: 'wiki-link-trigger'
}).overrideEditor(({ editor, tf: { insertText } }) => ({
  transforms: {
    insertText(text, options) {
      if (handleWikiLinkTrigger(editor, text, options)) return;
      insertText(text, options);
    }
  }
}));

export const WikiLinkInputPlugin = createPlatePlugin({
  key: WIKI_LINK_INPUT_TYPE,
  node: { isElement: true, isInline: true, isVoid: true }
}).withComponent(({ element, children, ...props }: PlateElementProps) => (
  <WikiLinkInputElement element={element} {...props}>
    {children}
  </WikiLinkInputElement>
));

export const WikiLinkInputElement = ({ element, children, ...props }: PlateElementProps) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const containerRef = useRef<HTMLSpanElement>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const { data: results = [], isLoading } = useDocumentPickerSearch(
    workspaceSlug,
    { q: searchText, limit: 8 },
    { enabled: !!searchText.trim() }
  );

  const removeInput = useCallback(
    (restoreText: string | null) => {
      editor.tf.removeNodes({ match: n => (n as TElement).type === WIKI_LINK_INPUT_TYPE });
      if (restoreText) editor.tf.insertText(restoreText, { at: undefined });
      editor.tf.focus();
    },
    [editor]
  );

  const select = useCallback(
    (nodeId: string) => {
      removeInput(null);
      insertOrReplaceInline(editor, {
        type: WIKI_LINK_TYPE,
        nodeId,
        children: [{ text: '' }]
      } as TElement);
    },
    [editor, removeInput]
  );

  const stateRef = useRef({ results, selectedIndex, searchText });
  useEffect(() => {
    stateRef.current = { results, selectedIndex, searchText };
  });

  useEffect(() => {
    const contentEditable = containerRef.current?.closest('[contenteditable="true"]');
    if (!contentEditable) return;

    const onKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;
      const state = stateRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        removeInput(`[[${state.searchText}`);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i =>
          e.key === 'ArrowDown' ? Math.min(i + 1, state.results.length - 1) : Math.max(i - 1, 0)
        );
      } else if (e.key === 'Enter') {
        const doc = state.results[state.selectedIndex];
        e.preventDefault();
        e.stopPropagation();
        if (doc) select(doc.file.id);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        if (state.searchText === '') removeInput('[');
        else {
          setSearchText(state.searchText.slice(0, -1));
          setSelectedIndex(0);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setSearchText(state.searchText + e.key);
        setSelectedIndex(0);
      }
    };

    contentEditable.addEventListener('keydown', onKeyDown, true);
    return () => contentEditable.removeEventListener('keydown', onKeyDown, true);
  }, [removeInput, select]);

  const updatePos = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [updatePos]);

  return (
    <PlateElement element={element} as="span" {...props}>
      <span ref={containerRef} className={styles.slashTrigger} contentEditable={false}>
        [[{searchText}
      </span>
      {children}
      {pos &&
        createPortal(
          <div
            className={styles.slashDropdown}
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={event => event.preventDefault()}
          >
            {results.length === 0 ? (
              <div className={styles.slashItemDesc} style={{ padding: '6px 10px' }}>
                {!searchText.trim()
                  ? 'Type to search pages…'
                  : isLoading
                    ? 'Searching…'
                    : 'No pages found'}
              </div>
            ) : (
              results.map((doc, i) => (
                <button
                  key={doc.file.id}
                  type="button"
                  className={`${styles.slashItem} ${i === selectedIndex ? styles.slashItemActive : ''}`}
                  onClick={() => select(doc.file.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className={styles.slashItemText}>
                    <div className={styles.slashItemLabel}>{doc.file.name}</div>
                  </div>
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </PlateElement>
  );
};
