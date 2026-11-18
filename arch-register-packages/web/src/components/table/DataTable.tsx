import { useState, type ComponentProps, type ReactNode } from 'react';
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
                const shared = {
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
          {rows.map(row => (
            <Table.Row
              key={row.id}
              selected={isRowSelected?.(row.original) ?? (selectable && row.getIsSelected())}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
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
                return (
                  <Table.Cell
                    key={cell.id}
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
