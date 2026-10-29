import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { BarList, type BarListRow } from './BarList';

const ROWS: BarListRow[] = [
  { id: 'a', label: 'Row A', sublabel: 'sub A', effective: 1, total: 4 },
  { id: 'b', label: 'Row B', effective: 3, total: 3, valueLabel: '100%' }
];

describe('BarList', () => {
  test('renders a row per item with label, sublabel and value text', () => {
    const html = renderToStaticMarkup(<BarList rows={ROWS} getColor={() => 'red'} />);
    expect(html).toContain('Row A');
    expect(html).toContain('sub A');
    expect(html).toContain('1/4');
    expect(html).toContain('100%');
  });

  test('clamps the bar width to minBarPct and colours via getColor', () => {
    const zeroRow: BarListRow = { id: 'z', label: 'Zero', effective: 0, total: 4 };
    const html = renderToStaticMarkup(
      <BarList
        rows={[zeroRow, ROWS[1]!]}
        getColor={row => (row.id === 'z' ? 'blue' : 'green')}
        minBarPct={5}
      />
    );
    expect(html).toContain('width:5%');
    expect(html).toContain('background:blue');
    expect(html).toContain('background:green');
  });

  test('renders rows as buttons that call onOpenItem when provided', () => {
    const onOpenItem = vi.fn();
    const html = renderToStaticMarkup(
      <BarList rows={ROWS} getColor={() => 'red'} onOpenItem={onOpenItem} />
    );
    expect(html).toContain('<button');
  });

  test('renders plain (non-button) rows when onOpenItem is omitted', () => {
    const html = renderToStaticMarkup(<BarList rows={ROWS} getColor={() => 'red'} />);
    expect(html).not.toContain('<button');
  });

  test('renders emptyMessage when there are no rows', () => {
    const html = renderToStaticMarkup(
      <BarList rows={[]} getColor={() => 'red'} emptyMessage="Nothing here" />
    );
    expect(html).toContain('Nothing here');
  });

  test('renders nothing when there are no rows and no emptyMessage', () => {
    const html = renderToStaticMarkup(<BarList rows={[]} getColor={() => 'red'} />);
    expect(html).toBe('');
  });
});
