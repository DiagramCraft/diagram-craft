import { renderToStaticMarkup } from 'react-dom/server';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, expect, test } from 'vitest';
import { GroupedListEditor } from './GroupedListEditor';

type Item = { id: string; name: string; group?: string };

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta', group: 'g1' },
  { id: 'c', name: 'Gamma', group: 'missing' }
];

const render = (groups = [{ id: 'g1' }, { id: 'g2' }]) =>
  renderToStaticMarkup(
    <DndProvider backend={HTML5Backend}>
      <GroupedListEditor<Item, { id: string }>
        items={ITEMS}
        groups={groups}
        getGroupId={i => i.group}
        getId={i => i.id}
        onMove={() => {}}
        renderGroupHeader={g => <h3>Header {g.id}</h3>}
        renderEmpty={g => <p>Empty {g.id}</p>}
        renderItem={i => <span>{i.name}</span>}
      />
    </DndProvider>
  );

describe('GroupedListEditor', () => {
  test('renders ungrouped items, including those with unknown groups, before the groups', () => {
    const html = render();
    expect(html.indexOf('Alpha')).toBeLessThan(html.indexOf('Header g1'));
    expect(html.indexOf('Gamma')).toBeLessThan(html.indexOf('Header g1'));
  });

  test('places grouped items under their group header', () => {
    const html = render();
    expect(html.indexOf('Header g1')).toBeLessThan(html.indexOf('Beta'));
    expect(html.indexOf('Beta')).toBeLessThan(html.indexOf('Header g2'));
  });

  test('shows the empty state only for empty groups', () => {
    const html = render();
    expect(html).toContain('Empty g2');
    expect(html).not.toContain('Empty g1');
  });

  test('has no add buttons of its own', () => {
    expect(render()).not.toContain('<button');
  });
});
