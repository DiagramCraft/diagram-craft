import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { MatrixTable } from './MatrixTable';

const rows = [
  { id: 'c1', label: 'Control 1', title: 'Control 1' },
  { id: 'c2', label: 'Control 2', title: 'Control 2' }
];
const columns = [
  { id: 'r1', label: 'Risk 1', title: 'Risk 1' },
  { id: 'r2', label: 'Risk 2', title: 'Risk 2' }
];

describe('MatrixTable', () => {
  test('renders cell content only in its own cell, with title', () => {
    const html = renderToStaticMarkup(
      <MatrixTable
        cornerLabel="corner"
        rows={rows}
        columns={columns}
        renderCell={(rowId, columnId) => (rowId === 'c1' && columnId === 'r2' ? 'MARK' : null)}
        getCellTitle={(rowId, columnId) =>
          rowId === 'c1' && columnId === 'r2' ? 'linked' : undefined
        }
      />
    );
    expect(html.match(/MARK/g)).toHaveLength(1);
    expect(html).toContain('title="linked"');
    expect(html.indexOf('Risk 2')).toBeLessThan(html.indexOf('MARK'));
  });

  test('wires row and column header clicks', () => {
    const opened: string[] = [];
    const html = renderToStaticMarkup(
      <MatrixTable
        cornerLabel="corner"
        rows={rows}
        columns={columns}
        renderCell={() => null}
        onOpenRow={id => opened.push(`row:${id}`)}
        onOpenColumn={id => opened.push(`col:${id}`)}
      />
    );
    expect(html).toContain('Control 1');
    expect(html.match(/<button/g)).toHaveLength(2);
  });

  test('renders row and column totals', () => {
    const html = renderToStaticMarkup(
      <MatrixTable
        cornerLabel="corner"
        rows={rows}
        columns={columns}
        renderCell={() => null}
        rowTotal={{ label: 'total', getValue: id => (id === 'c1' ? 3 : 0) }}
        columnTotal={{ label: 'per risk', getValue: id => (id === 'r2' ? 5 : 0) }}
      />
    );
    expect(html).toContain('>3<');
    expect(html).toContain('>5<');
    expect(html).toContain('per risk');
  });

  test('renders empty message when rows or columns are empty', () => {
    const html = renderToStaticMarkup(
      <MatrixTable
        cornerLabel="corner"
        rows={[]}
        columns={columns}
        renderCell={() => null}
        emptyMessage="Nothing to show"
      />
    );
    expect(html).toContain('Nothing to show');
    expect(html).not.toContain('<table');
  });
});
