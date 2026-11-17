import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

type Row = { id: string; name: string; role: string };

const DATA: Row[] = [
  { id: '1', name: 'Ada', role: 'Engineer' },
  { id: '2', name: 'Grace', role: 'Admiral' }
];

const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', meta: { sortable: true } },
  { id: 'role', header: 'Role', accessorKey: 'role', meta: { sortable: true } }
];

const render = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
  renderToStaticMarkup(<DataTable columns={COLUMNS} data={DATA} getRowId={r => r.id} {...props} />);

describe('DataTable', () => {
  test('renders headers and cells', () => {
    const html = render();
    expect(html.match(/<th[ >]/g)).toHaveLength(2);
    expect(html.match(/<tbody>.*<\/tbody>/)?.[0].match(/<tr/g)).toHaveLength(2);
    expect(html).toContain('Ada');
    expect(html).toContain('Admiral');
  });

  test('sets aria-sort only on the active sortable column', () => {
    const html = render({ sort: { key: 'name', dir: 'desc' }, onSort: () => {} });
    expect(html.match(/aria-sort/g)).toHaveLength(1);
    expect(html).toContain('aria-sort="descending"');
    expect(render({ sort: { key: 'role', dir: 'asc' }, onSort: () => {} })).toContain(
      'aria-sort="ascending"'
    );
  });

  test('renders plain headers without sort buttons when onSort is missing', () => {
    expect(render()).not.toContain('<button');
  });

  test('renders a header and row checkboxes when selectable', () => {
    const html = render({ selectable: true });
    expect(html).toContain('aria-label="Select all rows"');
    expect(html.match(/aria-label="Select row"/g)).toHaveLength(2);
    expect(render()).not.toContain('type="checkbox"');
  });

  test('marks rows selected from selectedRowIds', () => {
    const html = render({ selectable: true, selectedRowIds: { '1': true } });
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  test('rows are clickable only when onRowClick is set', () => {
    const body = (h: string) => h.match(/<tbody>.*<\/tbody>/)![0];
    expect(body(render())).not.toContain('rowClickable');
    expect(body(render({ onRowClick: () => {} }))).toContain('rowClickable');
  });

  test('renders the empty state spanning all columns', () => {
    const html = render({ data: [], emptyState: 'Nothing here', selectable: true });
    expect(html).toContain('Nothing here');
    expect(html).toContain('colSpan="3"');
  });
});
