import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from 'react';
import {
  flexRender,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState
} from '@tanstack/react-table';
import { Table } from './Table';
import type { SortState } from './useTableSort';
import { useColumnSizing } from './useColumnSizing';
import { useColumnLayout } from './useColumnLayout';
import { ColumnChooser } from './ColumnChooser';
import {
  extendTo,
  getCellState,
  getSelectedRange,
  isColumnSelected,
  moveFocus,
  selectAll,
  selectCell,
  selectColumns,
  serializeTsv,
  useCellSelection,
  type CellRef,
  type CellSelection,
  type Direction
} from './useCellSelection';

// Per-column presentation options, read from `columnDef.meta`. They map 1:1 onto props of the
// existing Table.* cells so DataTable renders identically to a hand-written Table.
export type DataTableColumnMeta = {
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
  sticky?: boolean;
  width?: number | string;
  primary?: boolean;
  // Cell clicks do not bubble to the row's onClick (e.g. cells holding buttons or links)
  interactive?: boolean;
  // Label shown in the column chooser; falls back to a string header, then the column id
  label?: string;
  // Set to false to keep the column always visible (not toggleable in the column chooser)
  hideable?: boolean;
  // Set to false to exclude the column from cell selection and copy
  selectable?: boolean;
  // Text used when copying the column's cells; defaults to the stringified cell value
  // biome-ignore lint/suspicious/noExplicitAny: column meta is not generic over the row type
  copyValue?: (row: any) => string;
};

// Width of the selection checkbox column (fixed in Table.module.css); pinned columns are shifted by it
const CHECKBOX_COLUMN_WIDTH = 32;

const columnId = (c: { id?: string; accessorKey?: unknown }) =>
  c.id ?? (typeof c.accessorKey === 'string' ? c.accessorKey : undefined);

const features = tableFeatures({
  rowSelectionFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnMeta: {} as DataTableColumnMeta
});

export type DataTableFeatures = typeof features;
export type DataTableColumn<T extends RowData> = ColumnDef<DataTableFeatures, T>;

type RootProps = Pick<
  ComponentProps<typeof Table.Root>,
  'scroll' | 'scrollY' | 'stickyHeader' | 'layout' | 'bordered' | 'className' | 'wrapClassName'
>;

type DataTableProps<T extends RowData> = RootProps & {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId?: (row: T, index: number) => string;
  // Sorting is controlled by the caller; columns opt in with `meta.sortable` and are keyed by column id
  sort?: SortState | null;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  // Adds a leading checkbox column, including a header checkbox with indeterminate state
  selectable?: boolean;
  selectedRowIds?: RowSelectionState;
  onSelectedRowIdsChange?: (selection: RowSelectionState) => void;
  isRowSelected?: (row: T) => boolean;
  emptyState?: ReactNode;
  // Drag handles on header edges; widths come from column `size`/`minSize`/`maxSize` (or `meta.width`)
  resizable?: boolean;
  columnSizing?: ColumnSizingState;
  onColumnSizingChange?: (sizing: ColumnSizingState) => void;
  // localStorage key under which resized widths are persisted
  persistKey?: string;
  // Shows a column chooser (toggle visibility, reorder, reset) above the table. Layout is persisted
  // under `${persistKey}:columns` when persistKey is set. Pinned (sticky) columns always stay leftmost.
  columnChooser?: boolean;
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (visibility: ColumnVisibilityState) => void;
  columnOrder?: ColumnOrderState;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  // Spreadsheet-style cell selection: click/shift-click/drag ranges, arrow keys, header click selects
  // a column (Alt/Cmd+click on sortable headers), Ctrl/Cmd+C copies the range as TSV
  cellSelection?: boolean;
  selectedCells?: CellSelection;
  onSelectedCellsChange?: (selection: CellSelection) => void;
  // Called with the copied text; `clipboard` overrides navigator.clipboard (mainly for tests)
  onCopy?: (text: string) => void;
  clipboard?: { writeText: (text: string) => Promise<void> | void };
  // Custom placement for the chooser; receives the chooser element (null when columnChooser is off)
  renderToolbar?: (chooser: ReactNode) => ReactNode;
};

export const DataTable = <T extends RowData>({
  columns,
  data,
  getRowId,
  sort = null,
  onSort,
  onRowClick,
  selectable = false,
  selectedRowIds,
  onSelectedRowIdsChange,
  isRowSelected,
  emptyState,
  resizable = false,
  columnSizing: columnSizingProp,
  onColumnSizingChange,
  persistKey,
  columnChooser = false,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  columnOrder: columnOrderProp,
  onColumnOrderChange,
  cellSelection: cellSelectionEnabled = false,
  selectedCells,
  onSelectedCellsChange,
  onCopy,
  clipboard,
  renderToolbar,
  ...rootProps
}: DataTableProps<T>) => {
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});
  const rowSelection = selectedRowIds ?? internalSelection;

  const [columnSizing, setColumnSizing] = useColumnSizing({
    columnSizing: columnSizingProp,
    onColumnSizingChange,
    persistKey
  });

  const [layout, setLayout] = useColumnLayout({
    columnVisibility: columnVisibilityProp,
    columnOrder: columnOrderProp,
    onColumnVisibilityChange,
    onColumnOrderChange,
    persistKey
  });

  // `meta.sticky` is the public API; it maps onto TanStack's left column pinning so every cell gets
  // an explicit offset (header and body) instead of Table.Row inferring it from its children.
  const stickyColumnIds = columns
    .filter(c => c.meta?.sticky)
    .map(c => columnId(c as { id?: string; accessorKey?: unknown }))
    .filter((id): id is string => id !== undefined && layout.visibility[id] !== false);
  const checkboxOffset = selectable && stickyColumnIds.length > 0 ? CHECKBOX_COLUMN_WIDTH : 0;
  const stickyStyle = (column: {
    getIsPinned: () => false | 'start' | 'end';
    getStart: (p: 'start') => number;
  }) =>
    column.getIsPinned() === 'start'
      ? { left: column.getStart('start') + checkboxOffset }
      : undefined;

  const table = useTable({
    features,
    columns,
    data,
    getRowId,
    enableRowSelection: selectable,
    enableColumnResizing: resizable,
    columnResizeMode: 'onEnd',
    state: {
      rowSelection,
      columnSizing,
      columnVisibility: layout.visibility,
      columnOrder: layout.order,
      columnPinning: { start: stickyColumnIds, end: [] }
    },
    onColumnSizingChange: updater =>
      setColumnSizing(typeof updater === 'function' ? updater(columnSizing) : updater),
    onColumnVisibilityChange: updater =>
      setLayout(
        {
          ...layout,
          visibility: typeof updater === 'function' ? updater(layout.visibility) : updater
        },
        'visibility'
      ),
    onColumnOrderChange: updater =>
      setLayout(
        { ...layout, order: typeof updater === 'function' ? updater(layout.order) : updater },
        'order'
      ),
    onRowSelectionChange: updater => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setInternalSelection(next);
      onSelectedRowIdsChange?.(next);
    }
  });

  const rows = table.getRowModel().rows;

  const [cells, setCells] = useCellSelection({
    cellSelection: selectedCells,
    onCellSelectionChange: onSelectedCellsChange
  });
  const rowIds = rows.map(r => r.id);
  const selectableColumns = table
    .getVisibleLeafColumns()
    .filter(c => c.columnDef.meta?.selectable !== false);
  const columnIds = selectableColumns.map(c => c.id);
  const range = cellSelectionEnabled ? getSelectedRange(rowIds, columnIds, cells) : null;
  const focus = range ? cells!.focus : null;

  // Marks this table's DOM so click-away can tell inside from outside (several tables may coexist)
  const tableId = useId();
  const hasSelection = cells !== null;
  useEffect(() => {
    if (!cellSelectionEnabled || !hasSelection) return;
    const onMouseDown = (ev: globalThis.MouseEvent) => {
      const target = ev.target;
      if (target instanceof Element && target.closest(`[data-cell-selection="${tableId}"]`)) return;
      setCells(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [cellSelectionEnabled, hasSelection, tableId, setCells]);

  const dragging = useRef(false);
  const didDrag = useRef(false);
  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    document.addEventListener('mouseup', stop);
    return () => document.removeEventListener('mouseup', stop);
  }, []);

  const onCellMouseDown = (ev: MouseEvent, cell: CellRef) => {
    if (ev.button !== 0) return;
    dragging.current = true;
    didDrag.current = false;
    setCells(ev.shiftKey ? extendTo(cells, cell) : selectCell(cell));
  };
  const onCellMouseEnter = (cell: CellRef) => {
    if (!dragging.current || !cells) return;
    if (cell.rowId === cells.focus.rowId && cell.columnId === cells.focus.columnId) return;
    didDrag.current = true;
    setCells(extendTo(cells, cell));
  };
  const onHeaderClick = (ev: MouseEvent, columnId: string, sortable: boolean) => {
    if (sortable && !ev.altKey && !ev.metaKey) return;
    const from = ev.shiftKey && cells ? cells.anchor.columnId : columnId;
    setCells(selectColumns(rowIds, from, columnId));
  };

  const copyRange = () => {
    if (!range) return;
    const text = serializeTsv(
      rows.slice(range.r0, range.r1 + 1).map(row =>
        selectableColumns.slice(range.c0, range.c1 + 1).map(col => {
          const copyValue = col.columnDef.meta?.copyValue;
          if (copyValue) return copyValue(row.original);
          const value = row.getValue(col.id);
          return value === null || value === undefined ? '' : String(value);
        })
      )
    );
    void (clipboard ?? navigator.clipboard)?.writeText(text);
    onCopy?.(text);
  };

  const KEY_DIRECTIONS: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Home: 'home',
    End: 'end'
  };
  const onTableKeyDown = (ev: KeyboardEvent<HTMLTableElement>) => {
    // Don't hijack keys meant for inputs/buttons inside cells
    if (ev.target !== ev.currentTarget) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const direction = KEY_DIRECTIONS[ev.key];
    if (direction) {
      ev.preventDefault();
      setCells(moveFocus(rowIds, columnIds, cells, direction, ev.shiftKey));
    } else if (mod && ev.key.toLowerCase() === 'a') {
      ev.preventDefault();
      setCells(selectAll(rowIds, columnIds));
    } else if (mod && ev.key.toLowerCase() === 'c') {
      ev.preventDefault();
      copyRange();
    } else if (ev.key === 'Escape') {
      setCells(null);
    }
  };

  const leafColumnCount = table.getVisibleLeafColumns().length + (selectable ? 1 : 0);

  const chooser = columnChooser ? (
    <ColumnChooser
      columns={table.getAllLeafColumns().map(c => {
        const header = c.columnDef.header;
        return {
          id: c.id,
          label: c.columnDef.meta?.label ?? (typeof header === 'string' ? header : c.id),
          visible: c.getIsVisible(),
          hideable: c.columnDef.meta?.hideable !== false
        };
      })}
      onVisibilityChange={(id, visible) =>
        setLayout({ ...layout, visibility: { ...layout.visibility, [id]: visible } }, 'visibility')
      }
      onOrderChange={order => setLayout({ ...layout, order }, 'order')}
      onReset={() => setLayout({ visibility: {}, order: [] }, 'both')}
    />
  ) : null;
  const toolbar = renderToolbar ? (
    renderToolbar(chooser)
  ) : chooser ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
      {chooser}
    </div>
  ) : null;

  return (
    <>
      {toolbar}
      <Table.Root
        {...rootProps}
        columnCount={leafColumnCount}
        layout={resizable ? 'fixed' : rootProps.layout}
        {...(cellSelectionEnabled
          ? {
              role: 'grid',
              tabIndex: 0,
              'aria-multiselectable': true,
              onKeyDown: onTableKeyDown,
              'data-cell-selection': tableId
            }
          : {})}
      >
        <Table.Head>
          {table.getHeaderGroups().map(group => (
            <tr key={group.id}>
              {selectable && (
                <Table.CheckboxCell
                  as="th"
                  aria-label="Select all rows"
                  sticky={checkboxOffset > 0}
                  style={checkboxOffset > 0 ? { left: 0 } : undefined}
                  checked={table.getIsAllRowsSelected()}
                  indeterminate={table.getIsSomeRowsSelected()}
                  onChange={table.getToggleAllRowsSelectedHandler()}
                />
              )}
              {group.headers.map(header => {
                const meta = header.column.columnDef.meta;
                const content = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                const columnIndex = columnIds.indexOf(header.column.id);
                const selectionProps =
                  cellSelectionEnabled && columnIndex >= 0
                    ? {
                        'data-selected': isColumnSelected(range, rowIds.length, columnIndex)
                          ? ''
                          : undefined,
                        onClick: (ev: MouseEvent) =>
                          onHeaderClick(ev, header.column.id, !!(meta?.sortable && onSort))
                      }
                    : undefined;
                const shared = {
                  ...selectionProps,
                  align: meta?.align,
                  numeric: meta?.numeric,
                  sticky: header.column.getIsPinned() === 'start',
                  style: stickyStyle(header.column),
                  width: resizable ? header.column.getSize() : meta?.width,
                  colSpan: header.colSpan > 1 ? header.colSpan : undefined
                };
                const resizer =
                  resizable && header.column.getCanResize() ? (
                    <Table.ResizeHandle
                      key={header.id}
                      active={header.column.getIsResizing()}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => header.column.resetSize()}
                    />
                  ) : undefined;
                return meta?.sortable && onSort ? (
                  <Table.SortableHeaderCell
                    key={header.id}
                    sortKey={header.column.id}
                    sort={sort}
                    onSort={onSort}
                    resizer={resizer}
                    {...shared}
                  >
                    {content}
                  </Table.SortableHeaderCell>
                ) : (
                  <Table.HeaderCell key={header.id} resizer={resizer} {...shared}>
                    {content}
                  </Table.HeaderCell>
                );
              })}
            </tr>
          ))}
        </Table.Head>
        <Table.Body>
          {rows.length === 0 && emptyState !== undefined && (
            <Table.EmptyRow colSpan={leafColumnCount}>{emptyState}</Table.EmptyRow>
          )}
          {rows.map((row, rowIndex) => (
            <Table.Row
              key={row.id}
              selected={isRowSelected?.(row.original) ?? (selectable && row.getIsSelected())}
              onClick={
                onRowClick
                  ? () => {
                      // A drag-select ends with a click on the last cell; it is not a row click
                      if (didDrag.current) {
                        didDrag.current = false;
                        return;
                      }
                      onRowClick(row.original);
                    }
                  : undefined
              }
            >
              {selectable && (
                <Table.CheckboxCell
                  aria-label="Select row"
                  sticky={checkboxOffset > 0}
                  style={checkboxOffset > 0 ? { left: 0 } : undefined}
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                />
              )}
              {row.getVisibleCells().map(cell => {
                const meta = cell.column.columnDef.meta;
                const columnIndex = columnIds.indexOf(cell.column.id);
                const ref: CellRef = { rowId: row.id, columnId: cell.column.id };
                const state =
                  range && columnIndex >= 0
                    ? getCellState(range, focus, rowIndex, columnIndex, row.id, cell.column.id)
                    : undefined;
                const selectionProps =
                  cellSelectionEnabled && columnIndex >= 0 && !meta?.interactive
                    ? {
                        'aria-selected': state?.selected ?? false,
                        'data-selected': state?.selected ? '' : undefined,
                        'data-active': state?.active ? '' : undefined,
                        'data-edge-top': state?.edgeTop ? '' : undefined,
                        'data-edge-right': state?.edgeRight ? '' : undefined,
                        'data-edge-bottom': state?.edgeBottom ? '' : undefined,
                        'data-edge-left': state?.edgeLeft ? '' : undefined,
                        onMouseDown: (ev: MouseEvent) => onCellMouseDown(ev, ref),
                        onMouseEnter: () => onCellMouseEnter(ref)
                      }
                    : undefined;
                return (
                  <Table.Cell
                    key={cell.id}
                    {...selectionProps}
                    align={meta?.align}
                    numeric={meta?.numeric}
                    sticky={cell.column.getIsPinned() === 'start'}
                    style={stickyStyle(cell.column)}
                    width={resizable ? cell.column.getSize() : meta?.width}
                    primary={meta?.primary}
                    interactive={meta?.interactive}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                );
              })}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
};
