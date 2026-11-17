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
