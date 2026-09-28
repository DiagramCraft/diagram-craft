import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { MatrixGrid, matrixCellKey } from './MatrixGrid';

const render = () =>
  renderToStaticMarkup(
    <MatrixGrid
      cornerLabel="corner"
      columns={[
        { key: 'a', label: 'Col A' },
        { key: 'b', label: 'Col B' }
      ]}
      rows={[{ key: 1, label: 'Row 1' }]}
      cells={new Map([[matrixCellKey(1, 'b'), [{ id: 'x', label: 'Item X', title: 'Full X' }]]])}
      getCellStyle={(_row, column) => ({
        color: 'red',
        emphasized: column === 'b',
        score: column === 'b' ? 7 : undefined
      })}
      onOpenItem={() => {}}
      legend={[{ label: 'Low', color: 'green' }]}
    />
  );

describe('MatrixGrid', () => {
  test('places items only in their cell', () => {
    const html = render();
    expect(html.match(/Item X/g)).toHaveLength(1);
    expect(html).toContain('title="Full X"');
    expect(html.indexOf('Col B')).toBeLessThan(html.indexOf('Item X'));
  });

  test('marks emphasized cells and renders score and legend', () => {
    const html = render();
    expect(html.match(/data-emphasized/g)).toHaveLength(1);
    expect(html).toContain('>7<');
    expect(html).toContain('Low');
  });
});
