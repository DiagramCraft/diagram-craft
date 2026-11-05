import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ListEditor, type ListEditorProps } from './ListEditor';

type Item = { id: string; name: string };

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' }
];

type Extra = Partial<
  Pick<
    ListEditorProps<Item>,
    | 'items'
    | 'label'
    | 'emptyMessage'
    | 'disabled'
    | 'maxItems'
    | 'addDisabled'
    | 'canRemove'
    | 'removeLabel'
    | 'layout'
    | 'renderFooter'
    | 'reorder'
    | 'header'
    | 'addControl'
  >
>;

const render = (extra: Extra = {}) =>
  renderToStaticMarkup(
    <ListEditor<Item>
      items={ITEMS}
      onChange={() => {}}
      createItem={() => ({ id: 'new', name: '' })}
      addLabel="Add item"
      renderItem={item => <span>{item.name}</span>}
      {...extra}
    />
  );

const renderOperations = (onRemove?: (item: Item, index: number) => void) =>
  renderToStaticMarkup(
    <ListEditor<Item>
      items={ITEMS}
      getId={item => item.id}
      onAdd={() => {}}
      onMove={() => {}}
      onRemove={onRemove}
      addLabel="Add item"
      renderItem={item => <span>{item.name}</span>}
    />
  );

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe('ListEditor', () => {
  test('renders one row per item with a remove button each', () => {
    const html = render();
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(count(html, /title="Remove"/g)).toBe(2);
  });

  test('renders the add button below the list when there is no label', () => {
    expect(render()).toContain('Add item');
  });

  test('wraps the list in a section with the add button in the header when labelled', () => {
    const html = render({ label: 'Things' });
    expect(html).toContain('Things');
    expect(html).toContain('Add item');
  });

  test('shows the empty message only when there are no items', () => {
    expect(render({ items: [], emptyMessage: 'Nothing here' })).toContain('Nothing here');
    expect(render({ emptyMessage: 'Nothing here' })).not.toContain('Nothing here');
  });

  test('disabled hides the add and remove controls', () => {
    const html = render({ disabled: true });
    expect(html).toContain('Alpha');
    expect(html).not.toContain('Add item');
    expect(html).not.toContain('title="Remove"');
  });

  test('maxItems hides the add button once reached', () => {
    expect(render({ maxItems: 2 })).not.toContain('Add item');
    expect(render({ maxItems: 3 })).toContain('Add item');
  });

  test('addDisabled keeps the add button but disables it', () => {
    const html = render({ addDisabled: true });
    expect(html).toContain('Add item');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
  });

  test('canRemove hides the remove button for rejected items', () => {
    const html = render({ canRemove: item => item.id !== 'a' });
    expect(count(html, /title="Remove"/g)).toBe(1);
  });

  test('uses the given removeLabel', () => {
    expect(render({ removeLabel: 'Delete row' })).toContain('title="Delete row"');
  });

  test('card layout draws the item box, row layout does not', () => {
    expect(render({ layout: 'card' })).toContain('itemBox');
    expect(render({ layout: 'row' })).not.toContain('itemBox');
  });

  test('bare layout renders only the item content', () => {
    const html = render({ layout: 'bare' });
    expect(html).toContain('Alpha');
    expect(html).not.toContain('title="Remove"');
  });

  test('renderFooter output is rendered inside each item', () => {
    const html = render({ renderFooter: item => <em>footer-{item.id}</em> });
    expect(html).toContain('footer-a');
    expect(html).toContain('footer-b');
  });

  test('operations mode only offers remove when onRemove is given', () => {
    expect(renderOperations()).not.toContain('title="Remove"');
    expect(renderOperations(() => {})).toContain('title="Remove"');
  });

  test('operations mode renders the add button', () => {
    expect(renderOperations()).toContain('Add item');
  });

  test('header="none" skips the section wrapper and puts the add button below', () => {
    const labelled = render({ label: 'Things' });
    const none = render({ label: 'Things', header: 'none' });
    expect(labelled).toContain('Things');
    expect(none).not.toContain('Things');
    expect(none).toContain('Add item');
  });

  test('addControl replaces the default add button', () => {
    const html = render({ addControl: <button type="button">Custom add</button> });
    expect(html).toContain('Custom add');
    expect(html).not.toContain('Add item');
  });

  test('addControl is hidden when disabled', () => {
    expect(render({ addControl: <button type="button">Custom add</button>, disabled: true })).not.toContain(
      'Custom add'
    );
  });
});
