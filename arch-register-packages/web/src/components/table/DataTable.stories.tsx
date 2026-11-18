import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from './DataTable';
import { useTableSort } from './useTableSort';
import { compareStrings } from '../../utils/compare';

const meta = {
  title: 'Components/DataTable',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Person = { id: string; name: string; role: string; email: string };

const PEOPLE: Person[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Engineer', email: 'ada@example.com' },
  { id: '2', name: 'Grace Hopper', role: 'Admiral', email: 'grace@example.com' },
  { id: '3', name: 'Alan Turing', role: 'Mathematician', email: 'alan@example.com' }
];

const COLUMNS: DataTableColumn<Person>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', meta: { sortable: true, primary: true } },
  { id: 'role', header: 'Role', accessorKey: 'role', meta: { sortable: true } },
  { id: 'email', header: 'Email', accessorKey: 'email' }
];

export const Basic: Story = {
  render: () => <DataTable columns={COLUMNS} data={PEOPLE} getRowId={r => r.id} />
};

export const Sortable: Story = {
  render: () => {
    const comparators = useMemo(
      () => ({
        name: (a: Person, b: Person) => compareStrings(a.name, b.name),
        role: (a: Person, b: Person) => compareStrings(a.role, b.role)
      }),
      []
    );
    const { sorted, sort, toggleSort } = useTableSort<Person, 'name' | 'role'>(
      PEOPLE,
      comparators,
      { key: 'name', dir: 'asc' }
    );
    return (
      <DataTable
        columns={COLUMNS}
        data={sorted}
        getRowId={r => r.id}
        sort={sort}
        onSort={key => toggleSort(key as 'name' | 'role')}
      />
    );
  }
};

export const Selectable: Story = {
  render: () => <DataTable columns={COLUMNS} data={PEOPLE} getRowId={r => r.id} selectable />
};

export const ClickableRows: Story = {
  render: () => {
    const [clicked, setClicked] = useState<string>('(none)');
    const columns: DataTableColumn<Person>[] = [
      ...COLUMNS,
      {
        id: 'action',
        header: '',
        meta: { interactive: true },
        cell: ({ row }) => (
          <button type="button" onClick={() => setClicked(`button: ${row.original.name}`)}>
            Button
          </button>
        )
      }
    ];
    return (
      <>
        <p>Last click: {clicked}</p>
        <DataTable
          columns={columns}
          data={PEOPLE}
          getRowId={r => r.id}
          onRowClick={p => setClicked(`row: ${p.name}`)}
        />
      </>
    );
  }
};

export const Empty: Story = {
  render: () => <DataTable columns={COLUMNS} data={[]} emptyState="No people found" />
};

export const Resizable: Story = {
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={PEOPLE}
      getRowId={p => p.id}
      resizable
      persistKey="story:datatable-resizable"
    />
  )
};

const WIDE_COLUMNS: DataTableColumn<Person>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    size: 180,
    meta: { primary: true, sticky: true }
  },
  { id: 'role', header: 'Role', accessorKey: 'role', size: 320 },
  { id: 'email', header: 'Email', accessorKey: 'email', size: 320 },
  { id: 'notes', header: 'Notes', accessorFn: () => 'Long free-text column', size: 480 }
];

// Name stays pinned while the rest scrolls horizontally; header cells are pinned too
export const StickyColumn: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <DataTable
        columns={WIDE_COLUMNS}
        data={PEOPLE}
        getRowId={p => p.id}
        scroll
        stickyHeader
        resizable
      />
    </div>
  )
};

// The selection checkbox is pinned too, and the sticky column is offset by its width
export const StickyColumnSelectable: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <DataTable
        columns={WIDE_COLUMNS}
        data={PEOPLE}
        getRowId={p => p.id}
        scroll
        stickyHeader
        resizable
        selectable
      />
    </div>
  )
};

// Two pinned columns; the second is offset by the first's width, including after resizing
export const MultipleStickyColumns: Story = {
  render: () => {
    const columns = WIDE_COLUMNS.map(c =>
      c.id === 'role' ? { ...c, size: 140, meta: { sticky: true } } : c
    );
    return (
      <div style={{ maxWidth: 520 }}>
        <DataTable
          columns={columns}
          data={PEOPLE}
          getRowId={p => p.id}
          scroll
          stickyHeader
          resizable
          persistKey="story:datatable-sticky-multi"
        />
      </div>
    );
  }
};
