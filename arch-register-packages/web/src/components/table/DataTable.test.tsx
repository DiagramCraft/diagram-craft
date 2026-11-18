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

  describe('resizing', () => {
    const handles = (html: string) => html.match(/cursor|resizeHandle/g)?.length ?? 0;

    test('renders no handles unless resizable', () => {
      expect(handles(render())).toBe(0);
    });

    test('renders a handle per resizable column and applies sizing widths', () => {
      const html = render({ resizable: true, columnSizing: { name: 321 } });
      expect(html.match(/resizeHandle/g)).toHaveLength(2);
      expect(html).toContain('width:321px');
    });

    test('skips handles for columns with enableResizing false', () => {
      const columns: DataTableColumn<Row>[] = [
        { ...COLUMNS[0]!, enableResizing: false },
        COLUMNS[1]!
      ];
      expect(render({ resizable: true, columns }).match(/resizeHandle/g)).toHaveLength(1);
    });

    test('keeps aria-sort alongside handles', () => {
      const html = render({
        resizable: true,
        sort: { key: 'name', dir: 'asc' },
        onSort: () => {}
      });
      expect(html).toContain('aria-sort="ascending"');
    });
  });

  describe('sticky columns', () => {
    const sticky = (n: number): DataTableColumn<Row>[] =>
      COLUMNS.map((c, i) => (i < n ? { ...c, meta: { ...c.meta, sticky: true } } : c));
    const lefts = (html: string) => [...html.matchAll(/left:(\d+)(?:px)?/g)].map(m => Number(m[1]));

    test('offsets header and body cells of a sticky column', () => {
      const html = render({ columns: sticky(1), resizable: true });
      expect(html.match(/stickyCol/g)).toHaveLength(3);
      expect(lefts(html)).toEqual([0, 0, 0]);
    });

    test('second sticky column is offset by the first width', () => {
      const html = render({
        columns: sticky(2),
        resizable: true,
        columnSizing: { name: 150, role: 100 }
      });
      expect(lefts(html)).toEqual([0, 150, 0, 150, 0, 150]);
    });

    test('pins the selection checkbox and shifts sticky columns by its width', () => {
      const html = render({ columns: sticky(1), selectable: true, resizable: true });
      expect(lefts(html)).toEqual([0, 32, 0, 32, 0, 32]);
    });

    test('adds no offsets without sticky columns', () => {
      const html = render({ selectable: true });
      expect(html).not.toContain('stickyCol');
      expect(html).not.toContain('left:');
    });
  });

  test('omits hidden columns from header and body', () => {
    const html = render({ columnVisibility: { role: false } });
    expect(html.match(/<th[ >]/g)).toHaveLength(1);
    expect(html).toContain('Ada');
    expect(html).not.toContain('Admiral');
  });

  test('respects column order', () => {
    const html = render({ columnOrder: ['role', 'name'] });
    expect(html.indexOf('Role')).toBeLessThan(html.indexOf('Name'));
    expect(html.indexOf('Engineer')).toBeLessThan(html.indexOf('Ada'));
  });

  test('renders the column chooser trigger only when enabled', () => {
    expect(render({ columnChooser: true })).toContain('aria-label="Choose columns"');
    expect(render()).not.toContain('Choose columns');
  });

  describe('cell selection', () => {
    const selectedCells = {
      anchor: { rowId: '1', columnId: 'name' },
      focus: { rowId: '2', columnId: 'role' }
    };

    test('is off by default', () => {
      const html = render({ selectedCells });
      expect(html).not.toContain('data-selected');
      expect(html).not.toContain('role="grid"');
    });

    test('makes the table a focusable grid when enabled', () => {
      const html = render({ cellSelection: true });
      expect(html).toContain('role="grid"');
      expect(html).toContain('tabindex="0"');
      expect(html.match(/aria-selected="false"/g)).toHaveLength(4);
    });

    test('marks the selected range, active cell and edges', () => {
      const html = render({ cellSelection: true, selectedCells });
      expect(html.match(/<td[^>]*data-selected/g)).toHaveLength(4);
      expect(html.match(/data-active/g)).toHaveLength(1);
      expect(html.match(/data-edge-top/g)).toHaveLength(2);
      expect(html.match(/data-edge-right/g)).toHaveLength(2);
    });

    test('marks full-height column selections on the header', () => {
      const html = render({
        cellSelection: true,
        selectedCells: {
          anchor: { rowId: '1', columnId: 'name' },
          focus: { rowId: '2', columnId: 'name' }
        }
      });
      expect(html.match(/<th[^>]*data-selected/g)).toHaveLength(1);
    });

    test('ignores a selection pointing at a hidden column', () => {
      const html = render({
        cellSelection: true,
        selectedCells,
        columnVisibility: { role: false }
      });
      expect(html).not.toContain('data-selected');
    });
  });
});
