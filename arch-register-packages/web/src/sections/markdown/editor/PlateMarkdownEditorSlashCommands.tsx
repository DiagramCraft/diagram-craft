import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PlateElement, useEditorRef } from 'platejs/react';
import type { PlateElementProps } from 'platejs/react';
import type { TElement } from 'platejs';
import { toggleList } from '@platejs/list';
import { getNodeText } from './EditorBlock';
import { MDX_COMPONENTS } from '../mdx-components/mdxRegistry';
import styles from './PlateMarkdownEditor.module.css';

type PlateEditor = ReturnType<typeof useEditorRef>;

// ─── Insertion helpers ───────────────────────────────────────────────────────

// When on an empty paragraph, replace it rather than splitting it (which would
// leave an extra empty block behind). For void blocks, always ensure a trailing
// paragraph so the user can continue typing after the inserted element.
export const insertOrReplaceBlock = (editor: PlateEditor, node: TElement) => {
  const isVoid = editor.api.isVoid(node);
  const trailingP = { type: 'p', children: [{ text: '' }] };
  const { selection } = editor;
  if (selection) {
    const topIndex = selection.anchor.path[0];
    if (topIndex !== undefined) {
      const block = editor.children[topIndex] as TElement | undefined;
      if (block?.type === 'p' && getNodeText(block as Record<string, unknown>) === '') {
        editor.tf.removeNodes({ at: [topIndex] });
        if (isVoid) {
          editor.tf.insertNodes([node, trailingP], { at: [topIndex] });
          editor.tf.select({ path: [topIndex + 1, 0], offset: 0 });
        } else {
          editor.tf.insertNodes(node, { at: [topIndex] });
        }
        return;
      }
    }
  }
  if (isVoid) {
    editor.tf.insertNodes([node, trailingP]);
  } else {
    editor.tf.insertNodes(node);
  }
};

// Inline void elements (mentions, links, labels, ...) leave the selection
// inside the inserted node's own (non-editable) text child unless we move it
// out explicitly — otherwise further typing silently goes nowhere.
export const insertOrReplaceInline = (editor: PlateEditor, node: TElement) => {
  editor.tf.insertNodes(node);
  const path = editor.api.findPath(node);
  if (!path) return;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1] as number;
  editor.tf.select({ path: [...parentPath, index + 1], offset: 0 });
};

// ─── Slash command definitions ──────────────────────────────────────────────

export type SlashCommandItem = {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  keywords?: string[];
  onSelect: (editor: PlateEditor) => void;
};

// Built-in (non-MDX) slash commands
export const BUILTIN_SLASH_COMMANDS: SlashCommandItem[] = [
  {
    key: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: (
      <span className={styles.slashIcon} style={{ fontWeight: 700 }}>
        H1
      </span>
    ),
    keywords: ['heading', 'title'],
    onSelect: editor => editor.tf.setNodes({ type: 'h1' })
  },
  {
    key: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: (
      <span className={styles.slashIcon} style={{ fontWeight: 700 }}>
        H2
      </span>
    ),
    keywords: ['heading', 'subtitle'],
    onSelect: editor => editor.tf.setNodes({ type: 'h2' })
  },
  {
    key: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: (
      <span className={styles.slashIcon} style={{ fontWeight: 700 }}>
        H3
      </span>
    ),
    keywords: ['heading'],
    onSelect: editor => editor.tf.setNodes({ type: 'h3' })
  },
  {
    key: 'p',
    label: 'Paragraph',
    description: 'Plain text paragraph',
    icon: <span className={styles.slashIcon}>¶</span>,
    keywords: ['text', 'plain'],
    onSelect: editor => editor.tf.setNodes({ type: 'p' })
  },
  {
    key: 'ul',
    label: 'Bulleted List',
    description: 'Unordered list',
    icon: <span className={styles.slashIcon}>•</span>,
    keywords: ['bullet', 'list'],
    onSelect: editor => toggleList(editor, { listStyleType: 'disc' })
  },
  {
    key: 'ol',
    label: 'Numbered List',
    description: 'Ordered list',
    icon: <span className={styles.slashIcon}>1.</span>,
    keywords: ['numbered', 'ordered'],
    onSelect: editor => toggleList(editor, { listStyleType: 'decimal' })
  },
  {
    key: 'checklist',
    label: 'Checklist',
    description: 'List of tasks with checkboxes',
    icon: <span className={styles.slashIcon}>☑</span>,
    keywords: ['task', 'todo', 'checkbox', 'list'],
    onSelect: editor => toggleList(editor, { listStyleType: 'todo' })
  },
  {
    key: 'code',
    label: 'Code Block',
    description: 'Fenced code block',
    icon: (
      <span className={styles.slashIcon} style={{ fontFamily: 'monospace' }}>
        {'{}'}
      </span>
    ),
    keywords: ['pre', 'code'],
    onSelect: editor =>
      insertOrReplaceBlock(editor, {
        type: 'code_block',
        children: [{ type: 'code_line', children: [{ text: '' }] }]
      })
  },
  {
    key: 'blockquote',
    label: 'Quote',
    description: 'Blockquote callout',
    icon: <span className={styles.slashIcon}>"</span>,
    keywords: ['quote', 'callout'],
    onSelect: editor =>
      insertOrReplaceBlock(editor, { type: 'blockquote', children: [{ text: '' }] })
  },
  {
    key: 'table',
    label: 'Table',
    description: 'Insert a table',
    icon: <span className={styles.slashIcon}>⊞</span>,
    keywords: ['table', 'grid'],
    onSelect: editor =>
      insertOrReplaceBlock(editor, {
        type: 'table',
        children: [
          {
            type: 'tr',
            children: [
              { type: 'th', children: [{ text: 'Header 1' }] },
              { type: 'th', children: [{ text: 'Header 2' }] }
            ]
          },
          {
            type: 'tr',
            children: [
              { type: 'td', children: [{ text: '' }] },
              { type: 'td', children: [{ text: '' }] }
            ]
          }
        ]
      })
  },
  {
    key: 'hr',
    label: 'Divider',
    description: 'Horizontal rule',
    icon: <span className={styles.slashIcon}>—</span>,
    keywords: ['divider', 'rule', 'line'],
    onSelect: editor => {
      const { selection } = editor;
      if (selection) {
        const topIndex = selection.anchor.path[0];
        if (topIndex !== undefined) {
          const block = editor.children[topIndex] as TElement | undefined;
          if (block?.type === 'p' && getNodeText(block as Record<string, unknown>) === '') {
            editor.tf.removeNodes({ at: [topIndex] });
            editor.tf.insertNodes(
              [
                { type: 'hr', children: [{ text: '' }] },
                { type: 'p', children: [{ text: '' }] }
              ],
              { at: [topIndex] }
            );
            return;
          }
        }
      }
      editor.tf.insertNodes([
        { type: 'hr', children: [{ text: '' }] },
        { type: 'p', children: [{ text: '' }] }
      ]);
    }
  }
];

// MDX component slash commands — derived from the registry
export const MDX_SLASH_COMMANDS: SlashCommandItem[] = Object.entries(MDX_COMPONENTS).flatMap(
  ([, spec]) => {
    const cmd = spec.editorSpec?.slashCommand;
    if (!cmd) return [];
    return [
      {
        key: cmd.key,
        label: cmd.label,
        description: cmd.description,
        icon: <span className={styles.slashIcon}>{cmd.icon}</span>,
        keywords: cmd.keywords,
        onSelect: (editor: PlateEditor) =>
          cmd.onSelect(editor, { insertOrReplaceBlock, insertOrReplaceInline })
      }
    ];
  }
);

export const SLASH_COMMANDS: SlashCommandItem[] = [
  ...BUILTIN_SLASH_COMMANDS,
  ...MDX_SLASH_COMMANDS
];

// ─── Slash input element ────────────────────────────────────────────────────

export const SlashInputElement = ({ element, children, ...props }: PlateElementProps) => {
  const editor = useEditorRef();
  const containerRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchText, setSearchText] = useState('');

  const filteredCommands = useMemo(
    () =>
      SLASH_COMMANDS.filter(cmd => {
        if (!searchText) return true;
        const q = searchText.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ?? cmd.keywords?.some(k => k.includes(q)) ?? false
        );
      }),
    [searchText]
  );

  useEffect(() => {
    const item = dropdownRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const removeSlashInput = useCallback(
    (focusEditor = true) => {
      editor.tf.removeNodes({ match: n => (n as TElement).type === 'slash_input' });
      if (focusEditor) editor.tf.focus();
    },
    [editor]
  );

  const executeCommand = useCallback(
    (cmd: SlashCommandItem) => {
      removeSlashInput(false);
      cmd.onSelect(editor);
    },
    [editor, removeSlashInput]
  );

  // Keyboard navigation via the contenteditable ancestor
  const selectedIndexRef = useRef(selectedIndex);
  const filteredCommandsRef = useRef(filteredCommands);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    filteredCommandsRef.current = filteredCommands;
  }, [filteredCommands]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const contentEditable = el.closest('[contenteditable="true"]');
    if (!contentEditable) return;

    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as globalThis.KeyboardEvent;
      if (
        keyboardEvent.key.length === 1 &&
        !keyboardEvent.ctrlKey &&
        !keyboardEvent.metaKey &&
        !keyboardEvent.altKey
      ) {
        setSearchText(previous => previous + keyboardEvent.key);
        setSelectedIndex(0);
      } else if (keyboardEvent.key === 'Backspace') {
        setSearchText(previous => previous.slice(0, -1));
        setSelectedIndex(0);
      }
      if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        removeSlashInput();
        return;
      }
      if (keyboardEvent.key === 'ArrowDown') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        setSelectedIndex(i => Math.min(i + 1, filteredCommandsRef.current.length - 1));
        return;
      }
      if (keyboardEvent.key === 'ArrowUp') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (keyboardEvent.key === 'Enter') {
        const cmd = filteredCommandsRef.current[selectedIndexRef.current];
        if (cmd) {
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation();
          executeCommand(cmd);
        }
      }
    };

    contentEditable.addEventListener('keydown', handleKeyDown);
    return () => contentEditable.removeEventListener('keydown', handleKeyDown);
  }, [removeSlashInput, executeCommand]);

  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const updateDropdownPos = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const DROPDOWN_MAX_HEIGHT = 320;
    const GAP = 4;

    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const openAbove = spaceBelow < DROPDOWN_MAX_HEIGHT && rect.top > spaceBelow;
    const top = openAbove ? Math.max(GAP, rect.top - GAP - DROPDOWN_MAX_HEIGHT) : rect.bottom + GAP;

    const nextPos = { top, left: rect.left };
    setDropdownPos(prev =>
      prev?.top === nextPos.top && prev?.left === nextPos.left ? prev : nextPos
    );
  }, []);

  useEffect(() => {
    updateDropdownPos();

    window.addEventListener('resize', updateDropdownPos);
    window.addEventListener('scroll', updateDropdownPos, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPos);
      window.removeEventListener('scroll', updateDropdownPos, true);
    };
  }, [updateDropdownPos]);

  return (
    <PlateElement element={element} as="span" {...props}>
      <span ref={containerRef} className={styles.slashTrigger}>
        /{children}
      </span>
      {filteredCommands.length > 0 &&
        dropdownPos &&
        createPortal(
          <div
            ref={dropdownRef}
            className={styles.slashDropdown}
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onMouseDown={event => event.preventDefault()}
          >
            {filteredCommands.map((cmd, i) => (
              <button
                type="button"
                key={cmd.key}
                className={`${styles.slashItem} ${
                  i === selectedIndex ? styles.slashItemActive : ''
                }`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {cmd.icon}
                <div className={styles.slashItemText}>
                  <div className={styles.slashItemLabel}>{cmd.label}</div>
                  <div className={styles.slashItemDesc}>{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>,
          document.body
        )}
    </PlateElement>
  );
};
