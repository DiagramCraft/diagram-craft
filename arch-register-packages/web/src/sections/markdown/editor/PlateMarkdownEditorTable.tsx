import { Children, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { PlateElement, useEditorRef, useEditorSelector } from 'platejs/react';
import type { PlateElementProps } from 'platejs/react';
import type { SlateEditor, TElement } from 'platejs';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { EditorBlock } from './EditorBlock';
import styles from './PlateMarkdownEditor.module.css';

// ─── Table renderers ─────────────────────────────────────────────────────────

export const TableElement = ({ element, children, ...props }: PlateElementProps) => {
  const rows = element.children as TElement[];
  const firstBodyRow = rows.findIndex(
    row => ((row.children as TElement[] | undefined)?.[0]?.type ?? 'td') !== 'th'
  );
  const headerCount = firstBodyRow === -1 ? rows.length : firstBodyRow;
  const childArray = Children.toArray(children);
  const headRows = childArray.slice(0, headerCount);
  const bodyRows = childArray.slice(headerCount);
  return (
    <EditorBlock as="table" suppressCellHover element={element} {...props}>
      {headRows.length > 0 && <thead>{headRows}</thead>}
      {bodyRows.length > 0 && <tbody>{bodyRows}</tbody>}
    </EditorBlock>
  );
};

export const TableRowElement = (props: PlateElementProps) => <PlateElement as="tr" {...props} />;

// ─── Table cell context menu ────────────────────────────────────────────────

const TableCellContextMenu = ({
  element,
  position,
  onClose
}: {
  element: TElement;
  position: { x: number; y: number };
  onClose: () => void;
}) => {
  const editor = useEditorRef();

  const getTableInfo = () => {
    const cellPath = editor.api.findPath(element);
    if (!cellPath || cellPath.length < 3) return null;
    const tableIdx = cellPath[0]!;
    const rowIdx = cellPath[1]!;
    const cellIdx = cellPath[2]!;
    const tableNode = editor.children[tableIdx] as TElement;
    const rows = tableNode?.children as TElement[] | undefined;
    if (!rows) return null;
    return { tableIdx, rowIdx, cellIdx, rows };
  };

  const addRow = (above: boolean) => {
    const info = getTableInfo();
    if (!info) return;
    const { tableIdx, rowIdx, rows } = info;
    const colCount = (rows[0]?.children as TElement[] | undefined)?.length ?? 0;
    const newCells = Array.from({ length: colCount }, () => ({
      type: 'td' as const,
      children: [{ text: '' }]
    }));
    editor.tf.insertNodes(
      { type: 'tr', children: newCells },
      { at: [tableIdx, above ? rowIdx : rowIdx + 1] }
    );
    onClose();
  };

  const addColumn = (before: boolean) => {
    const info = getTableInfo();
    if (!info) return;
    const { tableIdx, cellIdx, rows } = info;
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx] as TElement;
      const existingCell = (row.children as TElement[])[cellIdx];
      const cellType = existingCell?.type === 'th' ? 'th' : 'td';
      editor.tf.insertNodes(
        { type: cellType, children: [{ text: '' }] },
        { at: [tableIdx, rIdx, before ? cellIdx : cellIdx + 1] }
      );
    }
    onClose();
  };

  const removeRow = () => {
    const info = getTableInfo();
    if (!info) return;
    const { tableIdx, rowIdx, rows } = info;
    if (rows.length <= 1) {
      editor.tf.removeNodes({ at: [tableIdx] });
    } else {
      editor.tf.removeNodes({ at: [tableIdx, rowIdx] });
    }
    onClose();
  };

  const removeColumn = () => {
    const info = getTableInfo();
    if (!info) return;
    const { tableIdx, cellIdx, rows } = info;
    const colCount = (rows[0]?.children as TElement[] | undefined)?.length ?? 0;
    if (colCount <= 1) {
      editor.tf.removeNodes({ at: [tableIdx] });
    } else {
      for (let rIdx = rows.length - 1; rIdx >= 0; rIdx--) {
        editor.tf.removeNodes({ at: [tableIdx, rIdx, cellIdx] });
      }
    }
    onClose();
  };

  return (
    <ContextMenu.Imperative x={position.x} y={position.y} onClose={onClose}>
      <Menu.Item onClick={() => addRow(true)}>Add row above</Menu.Item>
      <Menu.Item onClick={() => addRow(false)}>Add row below</Menu.Item>
      <Menu.Separator />
      <Menu.Item onClick={() => addColumn(true)}>Add column before</Menu.Item>
      <Menu.Item onClick={() => addColumn(false)}>Add column after</Menu.Item>
      <Menu.Separator />
      <Menu.Item type="danger" onClick={removeRow}>
        Remove row
      </Menu.Item>
      <Menu.Item type="danger" onClick={removeColumn}>
        Remove column
      </Menu.Item>
    </ContextMenu.Imperative>
  );
};

const TableCellWrapper = ({
  element,
  as,
  children,
  ...props
}: PlateElementProps & { as: 'td' | 'th' }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isFocused = useEditorSelector(
    ed => {
      if (!ed.selection) return false;
      const cellPath = ed.api.findPath(element);
      if (!cellPath) return false;
      const { focus } = ed.selection;
      return focus.path.length >= cellPath.length && cellPath.every((p, i) => focus.path[i] === p);
    },
    [element]
  );

  return (
    <>
      <PlateElement
        as={as}
        element={element}
        {...props}
        attributes={{
          ...props.attributes,
          onContextMenu: (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setContextMenu({ x: event.clientX, y: event.clientY });
          }
        }}
        className={isFocused ? styles.tableCellActive : undefined}
      >
        <div className={styles.tableCellContent}>{children}</div>
      </PlateElement>
      {contextMenu &&
        createPortal(
          <TableCellContextMenu
            element={element}
            position={contextMenu}
            onClose={() => setContextMenu(null)}
          />,
          document.body
        )}
    </>
  );
};

export const TableCellElement = (props: PlateElementProps) => (
  <TableCellWrapper as="td" {...props} />
);
export const TableHeaderCellElement = (props: PlateElementProps) => (
  <TableCellWrapper as="th" {...props} />
);

// ─── Table keyboard navigation ─────────────────────────────────────────────

/** Moves the caret between table cells for vertical arrow-key navigation. */
export const handleTableKeyDown = (editor: SlateEditor, event: KeyboardEvent) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const { selection } = editor;
  if (!selection) return;
  const focusPath = selection.focus.path;
  if (focusPath.length < 3) return;
  const tableIdx = focusPath[0]!;
  const tableNode = editor.children[tableIdx] as TElement | undefined;
  if (tableNode?.type !== 'table') return;
  const rowIdx = focusPath[1]!;
  const cellIdx = focusPath[2]!;
  const rows = tableNode.children as TElement[];
  const targetRowIdx = event.key === 'ArrowDown' ? rowIdx + 1 : rowIdx - 1;
  if (targetRowIdx < 0 || targetRowIdx >= rows.length) return;
  const targetRow = rows[targetRowIdx] as TElement | undefined;
  if (!targetRow) return;
  const targetCells = targetRow.children as TElement[];
  const targetCellIdx = Math.min(cellIdx, targetCells.length - 1);
  event.preventDefault();
  editor.tf.select({ path: [tableIdx, targetRowIdx, targetCellIdx, 0], offset: 0 });
};
