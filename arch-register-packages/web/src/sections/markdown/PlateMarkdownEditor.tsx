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
import { NodeIdPlugin, getPluginType } from 'platejs';
import { MarkdownPlugin, deserializeMd, serializeMd, parseAttributes, propsToAttributes, remarkMdx } from '@platejs/markdown';
import { DndPlugin, useDraggable, useDropLine, DndScroller } from '@platejs/dnd';
import { ListPlugin } from '@platejs/list/react';
import { toggleList } from '@platejs/list';
import { SlashPlugin, SlashInputPlugin } from '@platejs/slash-command/react';
import {
  useFloatingToolbarState,
  useFloatingToolbar,
  getDOMSelectionBoundingClientRect,
  offset,
  flip
} from '@platejs/floating';
import type { TElement, Value } from 'platejs';
import {
  TbChevronDown,
  TbChevronUp,
  TbGripVertical,
  TbTrash,
  TbId,
} from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { Toolbar } from '@diagram-craft/app-components/src/Toolbar';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useEntities } from '../../hooks/useEntities';
import { EntityCardBlock } from './EntityCardBlock';
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
    <TbGripVertical size={14} />
  </div>
);

// ─── Block action buttons (up / down / delete) ──────────────────────────────

const BlockActionButtons = ({ element }: { element: TElement }) => {
  const editor = useEditorRef();
  const path = editor.api.findPath(element);
  if (!path || path.length === 0) return null;

  const index = path[0]!;
  const isFirst = index === 0;
  const isLast = index === editor.children.length - 1;

  // Re-resolve path at click time to avoid stale closure issues
  const currentIndex = () => {
    const p = editor.api.findPath(element);
    return p && p.length > 0 ? p[0]! : null;
  };

  return (
    <div className={styles.blockActions} contentEditable={false}>
      <button
        type="button"
        className={styles.blockActionBtn}
        title="Move up"
        disabled={isFirst}
        onMouseDown={e => {
          e.preventDefault();
          const idx = currentIndex();
          if (idx === null || idx === 0) return;
          const node = editor.children[idx];
          if (node) {
            editor.tf.removeNodes({ at: [idx] });
            editor.tf.insertNodes(node, { at: [idx - 1] });
          }
        }}
      >
        <TbChevronUp size={11} />
      </button>
      <button
        type="button"
        className={styles.blockActionBtn}
        title="Move down"
        disabled={isLast}
        onMouseDown={e => {
          e.preventDefault();
          const idx = currentIndex();
          if (idx === null || idx >= editor.children.length - 1) return;
          const node = editor.children[idx];
          if (node) {
            editor.tf.removeNodes({ at: [idx] });
            editor.tf.insertNodes(node, { at: [idx + 1] });
          }
        }}
      >
        <TbChevronDown size={11} />
      </button>
      <button
        type="button"
        className={`${styles.blockActionBtn} ${styles.blockActionBtnDelete}`}
        title="Delete block"
        onMouseDown={e => {
          e.preventDefault();
          const idx = currentIndex();
          if (idx === null) return;
          editor.tf.removeNodes({ at: [idx] });
        }}
      >
        <TbTrash size={11} />
      </button>
    </div>
  );
};

// ─── Block context menu ──────────────────────────────────────────────────────

const CONVERTIBLE_TYPES = new Set(['p', 'h1', 'h2', 'h3', 'blockquote', 'code_block']);

const CONVERT_OPTIONS = [
  { type: 'p', label: 'Paragraph' },
  { type: 'h1', label: 'Heading 1' },
  { type: 'h2', label: 'Heading 2' },
  { type: 'h3', label: 'Heading 3' },
  { type: 'blockquote', label: 'Quote' },
  { type: 'list-disc', label: 'Bullet list' },
  { type: 'list-decimal', label: 'Numbered list' },
] as const;

type ConvertType = (typeof CONVERT_OPTIONS)[number]['type'];

const getNodeText = (node: Record<string, unknown>): string => {
  const text = node['text'];
  if (typeof text === 'string') return text;

  const children = Array.isArray(node['children'])
    ? (node['children'] as Record<string, unknown>[])
    : [];

  const type = node['type'];
  const separator = type === 'code_block' || type === 'code_line' ? '\n' : '';

  return children.map(getNodeText).join(separator).replace(/\n+$/u, '');
};

const createConvertedBlock = (type: Exclude<ConvertType, 'list-disc' | 'list-decimal'>, text: string) => ({
  type,
  children: [{ text }]
});

export const isListParagraph = (element: TElement) =>
  element.type === 'p' &&
  typeof (element as TElement & { listStyleType?: unknown }).listStyleType === 'string';

export const createListParagraph = (text: string, listStyleType: 'disc' | 'decimal') => ({
  type: 'p',
  indent: 1,
  listStyleType,
  children: [{ text }]
});

const BlockContextMenu = ({
  element,
  position,
  onClose,
  extraItems,
}: {
  element: TElement;
  position: { x: number; y: number };
  onClose: () => void;
  extraItems?: (onClose: () => void) => React.ReactNode;
}) => {
  const editor = useEditorRef();

  const currentIdx = () => {
    const p = editor.api.findPath(element);
    return p && p.length > 0 ? p[0]! : null;
  };

  const blockType = element.type as string;
  const isConvertible = CONVERTIBLE_TYPES.has(blockType);

  const handleRemove = () => {
    const idx = currentIdx();
    if (idx !== null) editor.tf.removeNodes({ at: [idx] });
    onClose();
  };

  const handleDuplicate = () => {
    const idx = currentIdx();
    if (idx !== null) {
      const node = editor.children[idx];
      if (node) editor.tf.insertNodes(node, { at: [idx + 1] });
    }
    onClose();
  };

  const handleConvert = (toType: ConvertType) => {
    const idx = currentIdx();
    if (idx === null) { onClose(); return; }

    const node = editor.children[idx] as TElement | undefined;
    const text = node ? getNodeText(node as Record<string, unknown>) : '';

    if (toType === 'list-disc' || toType === 'list-decimal') {
      editor.tf.removeNodes({ at: [idx] });
      editor.tf.insertNodes(createListParagraph(text, toType === 'list-decimal' ? 'decimal' : 'disc'), {
        at: [idx]
      });
    } else if (blockType === 'code_block') {
      editor.tf.removeNodes({ at: [idx] });
      editor.tf.insertNodes(createConvertedBlock(toType, text), { at: [idx] });
    } else {
      editor.tf.setNodes({ type: toType }, { at: [idx] });
    }
    onClose();
  };

  return (
    <ContextMenu.Imperative x={position.x} y={position.y} onClose={onClose}>
      {extraItems?.(onClose)}
      {extraItems && <Menu.Separator />}
      <Menu.Item onClick={handleDuplicate}>Duplicate block</Menu.Item>
      <Menu.Item type="danger" onClick={handleRemove}>Remove block</Menu.Item>
      {isConvertible && (
        <>
          <Menu.Separator />
          <Menu.SubMenu label="Convert to">
            {CONVERT_OPTIONS.filter(opt => opt.type !== blockType).map(opt => (
              <Menu.Item key={opt.type} onClick={() => handleConvert(opt.type)}>
                {opt.label}
              </Menu.Item>
            ))}
          </Menu.SubMenu>
        </>
      )}
    </ContextMenu.Imperative>
  );
};

// Reusable wrapper that adds drag/drop to any block element
const Draggable = ({
  element,
  as,
  children,
  extraContextMenuItems,
  ...plateProps
}: PlateElementProps & {
  as?: keyof HTMLElementTagNameMap;
  extraContextMenuItems?: (onClose: () => void) => React.ReactNode;
}) => {
  const { handleRef, nodeRef, isDragging } = useDraggable({ element });
  const { dropLine } = useDropLine({ id: element.id as string | undefined });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={nodeRef}
      className={`${styles.draggableBlock} ${isDragging ? styles.dragging : ''}`}
      onContextMenu={e => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {dropLine === 'top' && (
        <div className={styles.dropLine} contentEditable={false} />
      )}
      <DragHandle handleRef={handleRef} />
      <PlateElement as={as} element={element} {...plateProps}>
        {children}
      </PlateElement>
      <BlockActionButtons element={element} />
      {dropLine === 'bottom' && (
        <div className={styles.dropLine} contentEditable={false} />
      )}
      {contextMenu && (
        <BlockContextMenu
          element={element}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          extraItems={extraContextMenuItems}
        />
      )}
    </div>
  );
};

// ─── Block element components ───────────────────────────────────────────────

const PElement = (props: PlateElementProps) => (
  <Draggable as={isListParagraph(props.element) ? 'div' : 'p'} {...props} />
);
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

// ─── Entity card components ─────────────────────────────────────────────────

interface EntityCardSlateElement extends TElement {
  entityId: string;
}

const EntityPickerDialog = ({
  element,
  open,
  onClose,
  isNew,
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');

  const { data: entities = [] } = useEntities(workspaceSlug, {
    q: query || undefined,
    view: 'summary',
    limit: 8,
  });

  const selectEntity = (publicId: string) => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes({ entityId: publicId }, { at: path });
    }
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Choose entity"
      width={420}
      buttons={[{ label: 'Cancel', type: 'cancel', onClick: handleClose }]}
    >
      <div className={styles.entityPickerDialogContent}>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="text"
          className={styles.entityPickerInput}
          placeholder="Search for an entity…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {entities.length > 0 ? (
          <div className={styles.entityPickerResults}>
            {entities.map(entity => (
              <button
                key={entity._publicId}
                type="button"
                className={styles.entityPickerItem}
                onClick={() => selectEntity(entity._publicId)}
              >
                <span className={styles.entityPickerName}>{entity._name}</span>
                <span className={styles.entityPickerSchema}>{entity._schema?.name}</span>
              </button>
            ))}
          </div>
        ) : query ? (
          <div className={styles.entityPickerHint}>No entities found</div>
        ) : (
          <div className={styles.entityPickerHint}>Type to search…</div>
        )}
      </div>
    </Dialog>
  );
};

const EntityCardPlateElement = ({ element, children, ...props }: PlateElementProps) => {
  const entityId = (element as EntityCardSlateElement).entityId ?? '';
  const [pickerOpen, setPickerOpen] = useState(() => !entityId);
  const isNew = !entityId;

  const openPicker = () => setPickerOpen(true);

  return (
    <Draggable
      element={element}
      extraContextMenuItems={(onClose) => (
        <Menu.Item onClick={() => { openPicker(); onClose(); }}>Change entity</Menu.Item>
      )}
      {...props}
    >
      <div contentEditable={false}>
        {entityId ? (
          <EntityCardBlock id={entityId} onEdit={openPicker} />
        ) : (
          <div className={styles.entityCardPlaceholder} onClick={openPicker}>
            <TbId size={16} />
            <span>Choose entity…</span>
          </div>
        )}
      </div>
      {children}
      {pickerOpen && (
        <EntityPickerDialog
          element={element}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          isNew={isNew}
        />
      )}
    </Draggable>
  );
};

// ─── Leaf (mark) components ────────────────────────────────────────────────

const BoldLeaf = (props: PlateLeafProps) => <PlateLeaf as="strong" {...props} />;
const ItalicLeaf = (props: PlateLeafProps) => <PlateLeaf as="em" {...props} />;
const InlineCodeLeaf = (props: PlateLeafProps) => <PlateLeaf as="code" {...props} />;
const StrikethroughLeaf = (props: PlateLeafProps) => (
  <PlateLeaf as="s" {...props} />
);

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
    key: 'entity-card',
    label: 'Entity Card',
    description: 'Embed entity metadata inline',
    icon: <span className={styles.slashIcon}><TbId size={14} /></span>,
    keywords: ['entity', 'card', 'catalog', 'service'],
    onSelect: (editor) => {
      insertOrReplaceBlock(editor, {
        type: 'EntityCard',
        entityId: '',
        children: [{ text: '' }],
      });
    },
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

// ─── Slash input element ────────────────────────────────────────────────────

const SlashInputElement = ({ element, children, ...props }: PlateElementProps) => {
  const editor = useEditorRef();
  const containerRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchText, setSearchText] = useState('');

  const filteredCommands = SLASH_COMMANDS.filter(cmd => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      (cmd.keywords?.some(k => k.includes(q)) ?? false)
    );
  });

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
    const top = openAbove
      ? Math.max(GAP, rect.top - GAP - DROPDOWN_MAX_HEIGHT)
      : rect.bottom + GAP;

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
        const block = topIndex !== undefined ? (editor.children[topIndex] as TElement | undefined) : undefined;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdxRules: Record<string, any> = {
  EntityCard: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deserialize: (mdastNode: any, _deco: unknown, options: any) => ({
      children: [{ text: '' }],
      type: getPluginType(options.editor, 'EntityCard'),
      entityId: (parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>)['id'] ?? '',
    }),
    serialize: (slateNode: any) => ({
      attributes: propsToAttributes({ id: slateNode.entityId ?? '' }),
      children: [],
      name: 'EntityCard',
      type: 'mdxJsxFlowElement',
    }),
  },
};

const editorPlugins = [
  NodeIdPlugin,
  MarkdownPlugin.configure({ options: { rules: mdxRules, remarkPlugins: [remarkMdx] } }),
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
  createPlatePlugin({
    key: 'EntityCard',
    node: { isElement: true, isVoid: true }
  }).withComponent(EntityCardPlateElement),
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
