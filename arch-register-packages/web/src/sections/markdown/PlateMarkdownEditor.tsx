import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Plate,
  PlateContent,
  PlateElement,
  PlateLeaf,
  createPlatePlugin,
  usePlateEditor,
  useEditorRef,
  useEditorId,
  useEventEditorValue,
  type PlateElementProps,
  type PlateLeafProps
} from 'platejs/react';
import { NodeIdPlugin } from 'platejs';
import { MarkdownPlugin, deserializeMd, serializeMd } from '@platejs/markdown';
import { DndPlugin, useDraggable, useDropLine, DndScroller } from '@platejs/dnd';
import { SlashPlugin, SlashInputPlugin } from '@platejs/slash-command/react';
import {
  useFloatingToolbarState,
  useFloatingToolbar,
  getDOMSelectionBoundingClientRect,
  offset,
  flip
} from '@platejs/floating';
import type { TElement, Value } from 'platejs';
import styles from './PlateMarkdownEditor.module.css';

// ─── Drag handle & drop indicator ──────────────────────────────────────────

const DragHandle = ({
  handleRef
}: {
  handleRef: (el: Element | null) => void;
}) => (
  <div
    ref={handleRef}
    className={styles.dragHandle}
    contentEditable={false}
    title="Drag to reorder"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="4" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="4" cy="7" r="1.2" fill="currentColor" />
      <circle cx="4" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="9" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="9" cy="7" r="1.2" fill="currentColor" />
      <circle cx="9" cy="10.5" r="1.2" fill="currentColor" />
    </svg>
  </div>
);

// Reusable wrapper that adds drag/drop to any block element
const Draggable = ({
  element,
  as,
  children,
  ...plateProps
}: PlateElementProps & { as?: keyof HTMLElementTagNameMap }) => {
  const { handleRef, nodeRef, isDragging } = useDraggable({ element });
  const { dropLine } = useDropLine({ id: element.id as string | undefined });

  return (
    <div
      ref={nodeRef}
      className={`${styles.draggableBlock} ${isDragging ? styles.dragging : ''}`}
    >
      {dropLine === 'top' && (
        <div className={styles.dropLine} contentEditable={false} />
      )}
      <DragHandle handleRef={handleRef} />
      <PlateElement as={as} element={element} {...plateProps}>
        {children}
      </PlateElement>
      {dropLine === 'bottom' && (
        <div className={styles.dropLine} contentEditable={false} />
      )}
    </div>
  );
};

// ─── Block element components ───────────────────────────────────────────────

const PElement = (props: PlateElementProps) => <Draggable as="p" {...props} />;
const H1Element = (props: PlateElementProps) => <Draggable as="h1" {...props} />;
const H2Element = (props: PlateElementProps) => <Draggable as="h2" {...props} />;
const H3Element = (props: PlateElementProps) => <Draggable as="h3" {...props} />;
const BlockquoteElement = (props: PlateElementProps) => (
  <Draggable as="blockquote" {...props} />
);
const CodeBlockElement = (props: PlateElementProps) => (
  <Draggable as="pre" {...props} />
);
const CodeLineElement = (props: PlateElementProps) => (
  <PlateElement as="code" {...props} />
);

const ListElement = ({ element, ...props }: PlateElementProps) => {
  const as =
    (element as TElement & { listStyleType?: string }).listStyleType === 'decimal'
      ? ('ol' as const)
      : ('ul' as const);
  return <Draggable as={as} element={element} {...props} />;
};

const ListItemElement = (props: PlateElementProps) => (
  <PlateElement as="li" {...props} />
);
const ListItemContentElement = (props: PlateElementProps) => (
  <PlateElement {...props} />
);

const LinkElement = ({ element, children, ...props }: PlateElementProps) => {
  const url = (element as TElement & { url?: string }).url;
  return (
    <PlateElement element={element} {...props}>
      <a href={url}>{children}</a>
    </PlateElement>
  );
};

const HrElement = ({ children, ...props }: PlateElementProps) => (
  <Draggable {...props}>
    <hr contentEditable={false} />
    {children}
  </Draggable>
);

// ─── Leaf (mark) components ────────────────────────────────────────────────

const BoldLeaf = (props: PlateLeafProps) => <PlateLeaf as="strong" {...props} />;
const ItalicLeaf = (props: PlateLeafProps) => <PlateLeaf as="em" {...props} />;
const InlineCodeLeaf = (props: PlateLeafProps) => <PlateLeaf as="code" {...props} />;
const StrikethroughLeaf = (props: PlateLeafProps) => (
  <PlateLeaf as="s" {...props} />
);

// ─── Slash command definitions ──────────────────────────────────────────────

type SlashCommandItem = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: (editor: ReturnType<typeof useEditorRef>) => void;
};

const SLASH_COMMANDS: SlashCommandItem[] = [
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
    onSelect: editor =>
      editor.tf.insertNodes([
        {
          type: 'list',
          listStyleType: 'disc',
          children: [
            { type: 'li', children: [{ type: 'lic', children: [{ text: '' }] }] }
          ]
        }
      ])
  },
  {
    key: 'ol',
    label: 'Numbered List',
    description: 'Ordered list',
    icon: <span className={styles.slashIcon}>1.</span>,
    keywords: ['numbered', 'ordered'],
    onSelect: editor =>
      editor.tf.insertNodes([
        {
          type: 'list',
          listStyleType: 'decimal',
          children: [
            { type: 'li', children: [{ type: 'lic', children: [{ text: '' }] }] }
          ]
        }
      ])
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
      editor.tf.insertNodes([
        {
          type: 'code_block',
          children: [{ type: 'code_line', children: [{ text: '' }] }]
        }
      ])
  },
  {
    key: 'blockquote',
    label: 'Quote',
    description: 'Blockquote callout',
    icon: <span className={styles.slashIcon}>"</span>,
    keywords: ['quote', 'callout'],
    onSelect: editor =>
      editor.tf.insertNodes([{ type: 'blockquote', children: [{ text: '' }] }])
  },
  {
    key: 'hr',
    label: 'Divider',
    description: 'Horizontal rule',
    icon: <span className={styles.slashIcon}>—</span>,
    keywords: ['divider', 'rule', 'line'],
    onSelect: editor =>
      editor.tf.insertNodes([
        { type: 'hr', children: [{ text: '' }] },
        { type: 'p', children: [{ text: '' }] }
      ])
  }
];

// ─── Slash input element ────────────────────────────────────────────────────

const SlashInputElement = ({ element, children, ...props }: PlateElementProps) => {
  const editor = useEditorRef();
  const containerRef = useRef<HTMLSpanElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Search text is the Slate text content typed after "/"
  const searchText = (
    (element.children as Array<{ text?: string }>)[0]?.text ?? ''
  ).trimStart();

  const filteredCommands = SLASH_COMMANDS.filter(cmd => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      (cmd.keywords?.some(k => k.includes(q)) ?? false)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchText]);

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

    const handleKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') {
        ke.preventDefault();
        ke.stopPropagation();
        removeSlashInput();
        return;
      }
      if (ke.key === 'ArrowDown') {
        ke.preventDefault();
        ke.stopPropagation();
        setSelectedIndex(i =>
          Math.min(i + 1, filteredCommandsRef.current.length - 1)
        );
        return;
      }
      if (ke.key === 'ArrowUp') {
        ke.preventDefault();
        ke.stopPropagation();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (ke.key === 'Enter') {
        const cmd = filteredCommandsRef.current[selectedIndexRef.current];
        if (cmd) {
          ke.preventDefault();
          ke.stopPropagation();
          executeCommand(cmd);
        }
      }
    };

    contentEditable.addEventListener('keydown', handleKeyDown);
    return () => contentEditable.removeEventListener('keydown', handleKeyDown);
  }, [removeSlashInput, executeCommand]);

  // Dropdown position (computed each render to stay in sync with scrolling)
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
  });

  return (
    <PlateElement element={element} as="span" {...props}>
      <span ref={containerRef} className={styles.slashTrigger}>
        /{children}
      </span>
      {filteredCommands.length > 0 &&
        dropdownPos &&
        createPortal(
          <div
            className={styles.slashDropdown}
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onMouseDown={e => e.preventDefault()}
          >
            {filteredCommands.map((cmd, i) => (
              <button
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

// ─── Floating text-format toolbar ───────────────────────────────────────────

const MarkButton = ({
  mark,
  label,
  children
}: {
  mark: string;
  label: string;
  children: React.ReactNode;
}) => {
  const editor = useEditorRef();
  const isActive = !!((editor.api.marks() as Record<string, unknown> | null) ?? {})[mark];

  return (
    <button
      className={`${styles.toolbarBtn} ${isActive ? styles.toolbarBtnActive : ''}`}
      title={label}
      onMouseDown={e => {
        e.preventDefault();
        editor.tf.toggleMark(mark);
      }}
    >
      {children}
    </button>
  );
};

const HeadingButton = ({ type, label }: { type: string; label: string }) => {
  const editor = useEditorRef();
  return (
    <button
      className={styles.toolbarBtn}
      title={label}
      onMouseDown={e => {
        e.preventDefault();
        editor.tf.setNodes({ type });
      }}
    >
      {type.toUpperCase()}
    </button>
  );
};

const FloatingToolbar = () => {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue('focus');

  const state = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    floatingOptions: {
      placement: 'top',
      middleware: [offset(8), flip({ padding: 8 })],
      getBoundingClientRect: getDOMSelectionBoundingClientRect
    }
  });

  const { hidden, props: toolbarProps, ref } = useFloatingToolbar(state);

  if (hidden) return null;

  return (
    <div
      ref={ref}
      {...toolbarProps}
      className={styles.floatingToolbar}
      onMouseDown={e => e.preventDefault()}
    >
      <MarkButton mark="bold" label="Bold">
        <strong>B</strong>
      </MarkButton>
      <MarkButton mark="italic" label="Italic">
        <em>I</em>
      </MarkButton>
      <MarkButton mark="code" label="Inline code">
        <code>`</code>
      </MarkButton>
      <MarkButton mark="strikethrough" label="Strikethrough">
        <s>S</s>
      </MarkButton>
      <div className={styles.toolbarDivider} />
      <HeadingButton type="h1" label="Heading 1" />
      <HeadingButton type="h2" label="Heading 2" />
      <HeadingButton type="h3" label="Heading 3" />
    </div>
  );
};

// ─── Plugin definitions ─────────────────────────────────────────────────────

const editorPlugins = [
  NodeIdPlugin,
  MarkdownPlugin,
  DndPlugin,
  SlashPlugin,
  SlashInputPlugin.withComponent(SlashInputElement),
  createPlatePlugin({ key: 'p', node: { isElement: true } }).withComponent(PElement),
  createPlatePlugin({ key: 'h1', node: { isElement: true } }).withComponent(H1Element),
  createPlatePlugin({ key: 'h2', node: { isElement: true } }).withComponent(H2Element),
  createPlatePlugin({ key: 'h3', node: { isElement: true } }).withComponent(H3Element),
  createPlatePlugin({
    key: 'blockquote',
    node: { isElement: true }
  }).withComponent(BlockquoteElement),
  createPlatePlugin({
    key: 'code_block',
    node: { isElement: true }
  }).withComponent(CodeBlockElement),
  createPlatePlugin({
    key: 'code_line',
    node: { isElement: true }
  }).withComponent(CodeLineElement),
  createPlatePlugin({ key: 'list', node: { isElement: true } }).withComponent(
    ListElement
  ),
  createPlatePlugin({ key: 'li', node: { isElement: true } }).withComponent(
    ListItemElement
  ),
  createPlatePlugin({ key: 'lic', node: { isElement: true } }).withComponent(
    ListItemContentElement
  ),
  createPlatePlugin({
    key: 'a',
    node: { isElement: true, isInline: true }
  }).withComponent(LinkElement),
  createPlatePlugin({
    key: 'hr',
    node: { isElement: true, isVoid: true }
  }).withComponent(HrElement),
  createPlatePlugin({ key: 'bold', node: { isLeaf: true } }).withComponent(BoldLeaf),
  createPlatePlugin({ key: 'italic', node: { isLeaf: true } }).withComponent(
    ItalicLeaf
  ),
  createPlatePlugin({ key: 'code', node: { isLeaf: true } }).withComponent(
    InlineCodeLeaf
  ),
  createPlatePlugin({
    key: 'strikethrough',
    node: { isLeaf: true }
  }).withComponent(StrikethroughLeaf)
];

// ─── Main component ─────────────────────────────────────────────────────────

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
    <DndProvider backend={HTML5Backend}>
      <div className={styles.editor}>
        <Plate editor={editor} onChange={handleChange}>
          <PlateContent
            className={styles.plateContent}
            placeholder="Start writing, or type / for commands…"
            spellCheck
          />
          <FloatingToolbar />
          <DndScroller />
        </Plate>
      </div>
    </DndProvider>
  );
};
