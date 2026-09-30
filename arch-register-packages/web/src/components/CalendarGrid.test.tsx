import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { CalendarGrid } from './CalendarGrid';

describe('CalendarGrid', () => {
  test('renders each cell label, header-right value and body', () => {
    const html = renderToStaticMarkup(
      <CalendarGrid
        columns={3}
        cells={[
          { key: 'a', label: 'Week A', headerRight: '2', children: <div>Item A</div> },
          { key: 'b', label: 'Week B', emphasized: true, children: <div>No items</div> }
        ]}
      />
    );
    expect(html).toContain('Week A');
    expect(html).toContain('>2<');
    expect(html).toContain('Item A');
    expect(html).toContain('Week B');
    expect(html).toContain('No items');
  });

  test('emits a collapse media query only when collapse props are given', () => {
    const withCollapse = renderToStaticMarkup(
      <CalendarGrid
        columns={6}
        collapseColumns={3}
        collapseBreakpoint={1420}
        cells={[{ key: 'a', label: 'A', children: null }]}
      />
    );
    expect(withCollapse).toContain('@media (max-width: 1420px)');
    expect(withCollapse).toContain('repeat(3, minmax(0, 1fr))');

    const withoutCollapse = renderToStaticMarkup(
      <CalendarGrid columns={6} cells={[{ key: 'a', label: 'A', children: null }]} />
    );
    expect(withoutCollapse).not.toContain('@media');
  });
});
