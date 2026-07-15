import type { Meta, StoryObj } from '@storybook/react-vite';
import { Fragment, useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import { Table } from './Table';
import { DropdownMenu } from '../DropdownMenu';
import { TypeBadge } from '../TypeBadge';
import { useTableSort } from './useTableSort';
import { compareBy, compareStrings } from '../../utils/compare';

const meta = {
  title: 'Components/Table',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Person = { id: string; name: string; role: string; email: string };

const PEOPLE: Person[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Engineer', email: 'ada@example.com' },
  { id: '2', name: 'Grace Hopper', role: 'Admiral', email: 'grace@example.com' },
  { id: '3', name: 'Alan Turing', role: 'Mathematician', email: 'alan@example.com' }
];

export const Basic: Story = {
  render: () => (
    <Table.Root>
      <Table.Head>
        <tr>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Role</Table.HeaderCell>
          <Table.HeaderCell>Email</Table.HeaderCell>
        </tr>
      </Table.Head>
      <Table.Body>
        {PEOPLE.map(p => (
          <Table.Row key={p.id}>
            <Table.Cell>{p.name}</Table.Cell>
            <Table.Cell>{p.role}</Table.Cell>
            <Table.Cell>{p.email}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
};

export const Sortable: Story = {
  render: () => {
    const { sorted, sort, toggleSort } = useTableSort(PEOPLE, {
      name: compareBy(p => p.name, compareStrings),
      role: compareBy(p => p.role, compareStrings)
    });
    return (
      <Table.Root>
        <Table.Head>
          <tr>
            <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
              Name
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="role" sort={sort} onSort={toggleSort}>
              Role
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
          </tr>
        </Table.Head>
        <Table.Body>
          {sorted.map(p => (
            <Table.Row key={p.id}>
              <Table.Cell>{p.name}</Table.Cell>
              <Table.Cell>{p.role}</Table.Cell>
              <Table.Cell>{p.email}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
  }
};

export const Selectable: Story = {
  render: () => {
    const [selected, setSelected] = useState<Set<string>>(new Set(['1']));
    const allSelected = selected.size === PEOPLE.length;
    const someSelected = selected.size > 0 && selected.size < PEOPLE.length;
    return (
      <Table.Root>
        <Table.Head>
          <tr>
            <Table.CheckboxCell
              as="th"
              aria-label="Select all"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(PEOPLE.map(p => p.id)))}
            />
            <Table.HeaderCell>Name</Table.HeaderCell>
          </tr>
        </Table.Head>
        <Table.Body>
          {PEOPLE.map(p => (
            <Table.Row key={p.id} selected={selected.has(p.id)}>
              <Table.CheckboxCell
                aria-label={`Select ${p.name}`}
                checked={selected.has(p.id)}
                onChange={() =>
                  setSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  })
                }
              />
              <Table.Cell>{p.name}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
  }
};

export const NameCells: Story = {
  render: () => (
    <Table.Root>
      <Table.Head>
        <tr>
          <Table.HeaderCell>Name</Table.HeaderCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.NameCell
            icon={<TypeBadge color="#3b82f6" name="Service" icon="server" size={18} />}
            title="Payments API"
            subtitle="Handles all payment processing for the checkout flow"
          />
        </Table.Row>
        <Table.Row>
          <Table.NameCell
            icon={<TypeBadge color="#22c55e" name="Database" icon="database" size={18} />}
            title="Unlinked entity"
            titleMuted
          />
        </Table.Row>
      </Table.Body>
    </Table.Root>
  )
};

export const Actions: Story = {
  render: () => (
    <Table.Root>
      <Table.Head>
        <tr>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell />
        </tr>
      </Table.Head>
      <Table.Body>
        {PEOPLE.map(p => (
          <Table.Row key={p.id} onClick={() => alert(`navigate to ${p.name}`)}>
            <Table.Cell>{p.name}</Table.Cell>
            <Table.ActionsCell>
              <DropdownMenu
                trigger={<Table.DotsButton />}
                items={[
                  { label: 'Edit', onClick: () => alert(`edit ${p.name}`) },
                  { label: 'Delete', danger: true, onClick: () => alert(`delete ${p.name}`) }
                ]}
              />
            </Table.ActionsCell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
};

export const StickyColumns: Story = {
  render: () => {
    const columns = Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);
    return (
      <div style={{ maxWidth: 600 }}>
        <Table.Root scroll stickyHeader layout="fixed">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell sticky width={32} />
              <Table.HeaderCell sticky width={160}>
                Name
              </Table.HeaderCell>
              {columns.map(c => (
                <Table.HeaderCell key={c} width={120}>
                  {c}
                </Table.HeaderCell>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {PEOPLE.map(p => (
              <Table.Row key={p.id}>
                <Table.CheckboxCell
                  sticky
                  aria-label={`Select ${p.name}`}
                  checked={false}
                  onChange={() => {}}
                />
                <Table.NameCell sticky width={160} title={p.name} />
                {columns.map(c => (
                  <Table.Cell key={c}>{c} value</Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </div>
    );
  }
};

export const EmptyRow: Story = {
  render: () => (
    <Table.Root>
      <Table.Head>
        <tr>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Role</Table.HeaderCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.EmptyRow colSpan={2} title="No results" />
      </Table.Body>
    </Table.Root>
  )
};

export const GroupHeaderRow: Story = {
  render: () => (
    <Table.Root>
      <Table.Head>
        <tr>
          <Table.HeaderCell>Capability</Table.HeaderCell>
          <Table.HeaderCell>Admin</Table.HeaderCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.GroupHeaderRow colSpan={2}>Workspace</Table.GroupHeaderRow>
        <Table.Row>
          <Table.Cell>Manage members</Table.Cell>
          <Table.Cell>Yes</Table.Cell>
        </Table.Row>
        <Table.GroupHeaderRow colSpan={2}>Content</Table.GroupHeaderRow>
        <Table.Row>
          <Table.Cell>Edit documents</Table.Cell>
          <Table.Cell>Yes</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  )
};

export const DetailRow: Story = {
  render: () => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['1']));
    const toggle = (id: string) =>
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    return (
      <Table.Root>
        <Table.Head>
          <tr>
            <Table.HeaderCell style={{ width: 28 }} />
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Role</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
          </tr>
        </Table.Head>
        <Table.Body>
          {PEOPLE.map(p => {
            const isExpanded = expanded.has(p.id);
            return (
              <Fragment key={p.id}>
                <Table.Row>
                  <Table.Cell>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      onClick={() => toggle(p.id)}
                      style={{
                        display: 'inline-flex',
                        transform: isExpanded ? 'rotate(90deg)' : undefined,
                        transition: 'transform 100ms'
                      }}
                    >
                      <TbChevronRight size={12} />
                    </button>
                  </Table.Cell>
                  <Table.Cell>{p.name}</Table.Cell>
                  <Table.Cell>{p.role}</Table.Cell>
                  <Table.Cell>{p.email}</Table.Cell>
                </Table.Row>
                {isExpanded && (
                  <Table.DetailRow>
                    Additional detail for {p.name}, spanning the full width of the table via an
                    inferred colSpan.
                  </Table.DetailRow>
                )}
              </Fragment>
            );
          })}
        </Table.Body>
      </Table.Root>
    );
  }
};

export const NumericAlignment: Story = {
  render: () => (
    <Table.Root>
      <Table.Head>
        <tr>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell align="right">Count</Table.HeaderCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Widgets</Table.Cell>
          <Table.Cell numeric>1,024</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Gadgets</Table.Cell>
          <Table.Cell numeric>8</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  )
};

export const FixedLayout: Story = {
  render: () => (
    <Table.Root layout="fixed">
      <Table.Head>
        <tr>
          <Table.HeaderCell width="60%">Name</Table.HeaderCell>
          <Table.HeaderCell width="40%">Role</Table.HeaderCell>
        </tr>
      </Table.Head>
      <Table.Body>
        {PEOPLE.map(p => (
          <Table.Row key={p.id}>
            <Table.Cell>{p.name}</Table.Cell>
            <Table.Cell>{p.role}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
};
