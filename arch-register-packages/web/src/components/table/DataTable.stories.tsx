import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { Button } from '@diagram-craft/app-components/Button';
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

export const ColumnChooserStory: Story = {
  name: 'ColumnChooser',
  render: () => (
    <DataTable
      columns={COLUMNS.map((c, i) =>
        i === 0 ? { ...c, meta: { ...c.meta, hideable: false } } : c
      )}
      data={PEOPLE}
      getRowId={p => p.id}
      columnChooser
      persistKey="story:datatable-columns"
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

export const CellSelection: Story = {
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={PEOPLE}
      getRowId={r => r.id}
      cellSelection
      onCopy={text => console.log('copied', JSON.stringify(text))}
    />
  )
};

type Task = { id: string; title: string; points: number | null; status: string; done: boolean };

const TASKS: Task[] = [
  { id: '1', title: 'Write spec', points: 3, status: 'todo', done: false },
  { id: '2', title: 'Build editor', points: 5, status: 'doing', done: false },
  { id: '3', title: 'Review', points: null, status: 'done', done: true }
];

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Done' }
];

const TASK_COLUMNS: DataTableColumn<Task>[] = [
  {
    id: 'title',
    header: 'Title',
    accessorKey: 'title',
    meta: { editor: 'text', validate: z.string().min(1, 'Required') }
  },
  {
    id: 'points',
    header: 'Points',
    accessorKey: 'points',
    meta: {
      editor: 'number',
      numeric: true,
      validate: z.number().int().min(0, 'Must be 0 or more').nullable()
    }
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    cell: ({ getValue }) => STATUSES.find(s => s.value === getValue())?.label ?? '',
    meta: { editor: 'select', options: STATUSES, editable: (row: Task) => !row.done }
  },
  {
    id: 'done',
    header: 'Done',
    accessorKey: 'done',
    cell: ({ getValue }) => (getValue() ? 'Yes' : 'No'),
    meta: { editor: 'boolean' }
  }
];

export const EditableCells: Story = {
  render: () => {
    const [rows, setRows] = useState(TASKS);
    return (
      <DataTable
        columns={TASK_COLUMNS}
        data={rows}
        getRowId={r => r.id}
        cellSelection
        onCellEdit={(rowId, columnId, value) =>
          setRows(rs => rs.map(r => (r.id === rowId ? { ...r, [columnId]: value } : r)))
        }
      />
    );
  }
};

// Batched editing: edits collect in a pending map (marked as dirty) and are saved or discarded together
export const PendingChanges: Story = {
  render: () => {
    const [saved, setSaved] = useState(TASKS);
    const [pending, setPending] = useState<Record<string, Record<string, unknown>>>({});

    // The table shows saved values with pending ones merged on top
    const data = useMemo(
      () => saved.map(row => ({ ...row, ...pending[row.id] })),
      [saved, pending]
    );
    const count = Object.values(pending).reduce((n, cols) => n + Object.keys(cols).length, 0);

    return (
      <>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Button
            disabled={count === 0}
            onClick={() => {
              // A real app would send `pending` to the backend here as one request
              setSaved(data);
              setPending({});
            }}
          >
            Save {count > 0 ? `(${count})` : ''}
          </Button>
          <Button variant="secondary" disabled={count === 0} onClick={() => setPending({})}>
            Discard
          </Button>
        </div>
        <DataTable
          columns={TASK_COLUMNS}
          data={data}
          getRowId={r => r.id}
          cellSelection
          onCellsEdit={edits =>
            setPending(p => {
              const next = { ...p };
              for (const { rowId, columnId, value } of edits) {
                const original = saved.find(r => r.id === rowId)?.[columnId as keyof Task];
                const cols = { ...next[rowId] };
                // Editing a cell back to its saved value is no longer a change
                if (value === original) delete cols[columnId];
                else cols[columnId] = value;
                if (Object.keys(cols).length === 0) delete next[rowId];
                else next[rowId] = cols;
              }
              return next;
            })
          }
          isCellDirty={(rowId, columnId) => pending[rowId]?.[columnId] !== undefined}
        />
      </>
    );
  }
};
