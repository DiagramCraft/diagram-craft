import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  flexRender,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState
} from '@tanstack/react-table';
import { Table } from './Table';
import type { SortState } from './useTableSort';

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
};

const features = tableFeatures({
  rowSelectionFeature,
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
  ...rootProps
}: DataTableProps<T>) => {
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});
  const rowSelection = selectedRowIds ?? internalSelection;

  const table = useTable({
    features,
    columns,
    data,
    getRowId,
    enableRowSelection: selectable,
    state: { rowSelection },
    onRowSelectionChange: updater => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setInternalSelection(next);
      onSelectedRowIdsChange?.(next);
    }
  });

  const rows = table.getRowModel().rows;
  const leafColumnCount = table.getAllLeafColumns().length + (selectable ? 1 : 0);

  return (
    <Table.Root {...rootProps}>
      <Table.Head>
        {table.getHeaderGroups().map(group => (
          <tr key={group.id}>
            {selectable && (
              <Table.CheckboxCell
                as="th"
                aria-label="Select all rows"
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
                sticky: meta?.sticky,
                width: meta?.width,
                colSpan: header.colSpan > 1 ? header.colSpan : undefined
              };
              return meta?.sortable && onSort ? (
                <Table.SortableHeaderCell
                  key={header.id}
                  sortKey={header.column.id}
                  sort={sort}
                  onSort={onSort}
                  {...shared}
                >
                  {content}
                </Table.SortableHeaderCell>
              ) : (
                <Table.HeaderCell key={header.id} {...shared}>
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
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
              />
            )}
            {row.getAllCells().map(cell => {
              const meta = cell.column.columnDef.meta;
              return (
                <Table.Cell
                  key={cell.id}
                  align={meta?.align}
                  numeric={meta?.numeric}
                  sticky={meta?.sticky}
                  width={meta?.width}
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
  );
};
