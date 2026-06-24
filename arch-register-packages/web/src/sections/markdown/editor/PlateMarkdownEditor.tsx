import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { MarkdownPlugin, deserializeMd, serializeMd, remarkMdx } from '@platejs/markdown';
import { DndPlugin, DndScroller } from '@platejs/dnd';
import { ListPlugin } from '@platejs/list/react';
import { toggleList } from '@platejs/list';
import remarkGfm from 'remark-gfm';
import { SlashPlugin, SlashInputPlugin } from '@platejs/slash-command/react';
import {
  useFloatingToolbarState,
  useFloatingToolbar,
  getDOMSelectionBoundingClientRect,
  offset,
  flip
} from '@platejs/floating';
import type { TElement, Value } from 'platejs';
import { Toolbar } from '@diagram-craft/app-components/src/Toolbar';
import { EditorBlock, isListParagraph, getNodeText } from './EditorBlock';
import { MDX_COMPONENTS } from '../mdx-components/mdxRegistry';
import styles from './PlateMarkdownEditor.module.css';

// ─── Block element components ───────────────────────────────────────────────

const PElement = (props: PlateElementProps) => (
  <EditorBlock as={isListParagraph(props.element) ? 'div' : 'p'} {...props} />
);
const H1Element = (props: PlateElementProps) => <EditorBlock as="h1" {...props} />;
const H2Element = (props: PlateElementProps) => <EditorBlock as="h2" {...props} />;
const H3Element = (props: PlateElementProps) => <EditorBlock as="h3" {...props} />;
const BlockquoteElement = (props: PlateElementProps) => <EditorBlock as="blockquote" {...props} />;
const CodeBlockElement = (props: PlateElementProps) => <EditorBlock as="pre" {...props} />;
const CodeLineElement = (props: PlateElementProps) => <PlateElement as="code" {...props} />;

const ListElement = ({ element, ...props }: PlateElementProps) => {
  const as =
    (element as TElement & { listStyleType?: string }).listStyleType === 'decimal'
      ? ('ol' as const)
      : ('ul' as const);
  return <EditorBlock as={as} element={element} {...props} />;
};

const ListItemElement = (props: PlateElementProps) => <PlateElement as="li" {...props} />;
const ListItemContentElement = (props: PlateElementProps) => <PlateElement {...props} />;

const LinkElement = ({ element, children, ...props }: PlateElementProps) => {
  const url = (element as TElement & { url?: string }).url;
  return (
    <PlateElement element={element} {...props}>
      <a href={url}>{children}</a>
    </PlateElement>
  );
};

const HrElement = ({ children, ...props }: PlateElementProps) => (
  <EditorBlock {...props}>
    <hr contentEditable={false} />
    {children}
  </EditorBlock>
);

const TableElement = (props: PlateElementProps) => <EditorBlock as="table" suppressCellHover {...props} />;
const TableRowElement = (props: PlateElementProps) => <PlateElement as="tr" {...props} />;
const TableCellElement = (props: PlateElementProps) => <PlateElement as="td" {...props} />;
const TableHeaderCellElement = (props: PlateElementProps) => <PlateElement as="th" {...props} />;

// ─── Leaf (mark) components ────────────────────────────────────────────────

const BoldLeaf = (props: PlateLeafProps) => <PlateLeaf as="strong" {...props} />;
const ItalicLeaf = (props: PlateLeafProps) => <PlateLeaf as="em" {...props} />;
const InlineCodeLeaf = (props: PlateLeafProps) => <PlateLeaf as="code" {...props} />;
const StrikethroughLeaf = (props: PlateLeafProps) => <PlateLeaf as="s" {...props} />;

// ─── Slash command definitions ──────────────────────────────────────────────

// When on an empty paragraph, replace it rather than splitting it (which would
// leave an extra empty block behind).
const insertOrReplaceBlock = (editor: ReturnType<typeof useEditorRef>, node: TElement) => {
  const { selection } = editor;
  if (selection) {
    const topIndex = selection.anchor.path[0];
    if (topIndex !== undefined) {
      const block = editor.children[topIndex] as TElement | undefined;
      if (block?.type === 'p' && getNodeText(block as Record<string, unknown>) === '') {
        editor.tf.removeNodes({ at: [topIndex] });
        editor.tf.insertNodes(node, { at: [topIndex] });
        return;
      }
    }
  }
  editor.tf.insertNodes(node);
};

type SlashCommandItem = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: (editor: ReturnType<typeof useEditorRef>) => void;
};

// Built-in (non-MDX) slash commands
const BUILTIN_SLASH_COMMANDS: SlashCommandItem[] = [
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
const MDX_SLASH_COMMANDS: SlashCommandItem[] = Object.entries(MDX_COMPONENTS).flatMap(
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
        onSelect: (editor: ReturnType<typeof useEditorRef>) =>
          cmd.onSelect(editor, { insertOrReplaceBlock })
      }
    ];
  }
);

const SLASH_COMMANDS: SlashCommandItem[] = [...BUILTIN_SLASH_COMMANDS, ...MDX_SLASH_COMMANDS];

// ─── Slash input element ────────────────────────────────────────────────────

const SlashInputElement = ({ element, children, ...props }: PlateElementProps) => {
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
          cmd.label.toLowerCase().includes(q) || (cmd.keywords?.some(k => k.includes(q)) ?? false)
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

    const handleKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key.length === 1 && !ke.ctrlKey && !ke.metaKey && !ke.altKey) {
        setSearchText(prev => prev + ke.key);
        setSelectedIndex(0);
      } else if (ke.key === 'Backspace') {
        setSearchText(prev => prev.slice(0, -1));
        setSelectedIndex(0);
      }
      if (ke.key === 'Escape') {
        ke.preventDefault();
        ke.stopPropagation();
        removeSlashInput();
        return;
      }
      if (ke.key === 'ArrowDown') {
        ke.preventDefault();
        ke.stopPropagation();
        setSelectedIndex(i => Math.min(i + 1, filteredCommandsRef.current.length - 1));
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

  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

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
            onMouseDown={e => e.preventDefault()}
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
  const isActive = !!(editor.api.marks() as Record<string, unknown> | null)?.[mark];

  return (
    <Toolbar.Button
      type="button"
      data-pressed={isActive ? true : undefined}
      title={label}
      onMouseDown={e => {
        e.preventDefault();
        editor.tf.toggleMark(mark);
      }}
    >
      {children}
    </Toolbar.Button>
  );
};

const HeadingButton = ({ type, label }: { type: string; label: string }) => {
  const editor = useEditorRef();
  return (
    <Toolbar.Button
      type="button"
      title={label}
      onMouseDown={e => {
        e.preventDefault();
        editor.tf.setNodes({ type });
      }}
    >
      {type.toUpperCase()}
    </Toolbar.Button>
  );
};

const FloatingToolbar = () => {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue('focus');
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.querySelector('.ar-app'));
  }, []);

  const state = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    floatingOptions: {
      strategy: 'fixed',
      placement: 'top',
      middleware: [offset(8), flip({ padding: 8 })],
      getBoundingClientRect: getDOMSelectionBoundingClientRect
    }
  });

  const { hidden, props: toolbarProps, ref } = useFloatingToolbar(state);

  if (hidden) return null;

  const toolbar = (
    <div
      ref={ref}
      {...toolbarProps}
      className={styles.floatingToolbar}
      onMouseDown={e => e.preventDefault()}
    >
      <Toolbar.Root>
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
        <Toolbar.Separator />
        <HeadingButton type="h1" label="Heading 1" />
        <HeadingButton type="h2" label="Heading 2" />
        <HeadingButton type="h3" label="Heading 3" />
      </Toolbar.Root>
    </div>
  );

  return portalContainer ? createPortal(toolbar, portalContainer) : toolbar;
};

// ─── Plugin definitions ─────────────────────────────────────────────────────

const HEADING_TYPES = new Set(['h1', 'h2', 'h3']);

const HeadingBreakPlugin = createPlatePlugin({
  key: 'heading-break',
  extendEditor({ editor }) {
    const insertBreak = editor.insertBreak as (() => void) | undefined;
    editor.insertBreak = () => {
      const { selection } = editor;
      if (selection) {
        const topIndex = selection.anchor.path[0];
        const block =
          topIndex !== undefined ? (editor.children[topIndex] as TElement | undefined) : undefined;
        if (block && HEADING_TYPES.has(block.type as string)) {
          editor.tf.splitNodes({ always: true });
          editor.tf.setNodes({ type: 'p' });
          return;
        }
      }
      insertBreak?.();
    };
    return editor;
  }
});

// biome-ignore lint/suspicious/noExplicitAny: MDX plugin API requires flexible typing for mdast nodes
const mdxRules: Record<string, any> = Object.fromEntries(
  Object.entries(MDX_COMPONENTS)
    .filter(([, spec]) => spec.editorSpec?.mdxRule)
    .map(([name, spec]) => [name, spec.editorSpec!.mdxRule])
);

// Custom MDX element plugins — derived from the registry
const mdxElementPlugins = Object.entries(MDX_COMPONENTS).flatMap(([name, spec]) => {
  if (!spec.editorSpec) return [];
  const { nodeOptions, editableComponent } = spec.editorSpec;
  return [
    createPlatePlugin({
      key: name,
      node: { isElement: true, ...nodeOptions }
      // biome-ignore lint/suspicious/noExplicitAny: component typing bridged via registry
    }).withComponent(editableComponent as any)
  ];
});

const editorPlugins = [
  NodeIdPlugin,
  MarkdownPlugin.configure({ options: { rules: mdxRules, remarkPlugins: [remarkMdx, remarkGfm] } }),
  DndPlugin,
  SlashPlugin,
  SlashInputPlugin.withComponent(SlashInputElement),
  HeadingBreakPlugin,
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
  ListPlugin.withComponent(ListElement),
  createPlatePlugin({ key: 'li', node: { isElement: true } }).withComponent(ListItemElement),
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
  createPlatePlugin({ key: 'table', node: { isElement: true } }).withComponent(TableElement),
  createPlatePlugin({ key: 'tr', node: { isElement: true } }).withComponent(TableRowElement),
  createPlatePlugin({ key: 'td', node: { isElement: true } }).withComponent(TableCellElement),
  createPlatePlugin({ key: 'th', node: { isElement: true } }).withComponent(TableHeaderCellElement),
  ...mdxElementPlugins,
  createPlatePlugin({ key: 'bold', node: { isLeaf: true } }).withComponent(BoldLeaf),
  createPlatePlugin({ key: 'italic', node: { isLeaf: true } }).withComponent(ItalicLeaf),
  createPlatePlugin({ key: 'code', node: { isLeaf: true } }).withComponent(InlineCodeLeaf),
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
