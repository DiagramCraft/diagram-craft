import { useState } from 'react';
import { PlateElement, useEditorRef, type PlateElementProps } from 'platejs/react';
import type { TElement } from 'platejs';
import { useDraggable, useDropLine } from '@platejs/dnd';
import { TbChevronDown, TbChevronUp, TbGripVertical, TbTrash } from 'react-icons/tb';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import styles from './EditorBlock.module.css';

// ── Utilities ────────────────────────────────────────────────────────────────

export const getNodeText = (node: Record<string, unknown>): string => {
  const text = node['text'];
  if (typeof text === 'string') return text;
  const children = Array.isArray(node['children'])
    ? (node['children'] as Record<string, unknown>[])
    : [];
  const type = node['type'];
  const separator = type === 'code_block' || type === 'code_line' ? '\n' : '';
  return children.map(getNodeText).join(separator).replace(/\n+$/u, '');
};

export const isListParagraph = (element: TElement) =>
  element.type === 'p' &&
  typeof (element as TElement & { listStyleType?: unknown }).listStyleType === 'string';

export const createListParagraph = (text: string, listStyleType: 'disc' | 'decimal') => ({
  type: 'p',
  indent: 1,
  listStyleType,
  children: [{ text }]
});

// ── Drag handle ───────────────────────────────────────────────────────────────

const DragHandle = ({ handleRef }: { handleRef: (el: Element | null) => void }) => (
  <div
    ref={handleRef}
    className={styles.dragHandle}
    contentEditable={false}
    title="Drag to reorder"
  >
    <TbGripVertical size={14} />
  </div>
);

// ── Block action buttons ──────────────────────────────────────────────────────

const BlockActionButtons = ({ element }: { element: TElement }) => {
  const editor = useEditorRef();
  const path = editor.api.findPath(element);
  if (!path || path.length === 0) return null;

  const index = path[0]!;
  const isFirst = index === 0;
  const isLast = index === editor.children.length - 1;

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

// ── Block context menu ────────────────────────────────────────────────────────

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

const createConvertedBlock = (type: Exclude<ConvertType, 'list-disc' | 'list-decimal'>, text: string) => ({
  type,
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
      editor.tf.insertNodes(
        createListParagraph(text, toType === 'list-decimal' ? 'decimal' : 'disc'),
        { at: [idx] }
      );
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

// ── EditorBlock wrapper ───────────────────────────────────────────────────────

export const EditorBlock = ({
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
