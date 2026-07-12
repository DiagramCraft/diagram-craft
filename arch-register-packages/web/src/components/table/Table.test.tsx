import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Table } from './Table';

describe('Table.SortableHeaderCell', () => {
  it('sets aria-sort="ascending" when active and ascending', () => {
    const markup = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <Table.SortableHeaderCell sortKey="name" sort={{ key: 'name', dir: 'asc' }} onSort={() => {}}>
              Name
            </Table.SortableHeaderCell>
          </tr>
        </thead>
      </table>
    );
    expect(markup).toContain('aria-sort="ascending"');
  });

  it('sets aria-sort="descending" when active and descending', () => {
    const markup = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <Table.SortableHeaderCell sortKey="name" sort={{ key: 'name', dir: 'desc' }} onSort={() => {}}>
              Name
            </Table.SortableHeaderCell>
          </tr>
        </thead>
      </table>
    );
    expect(markup).toContain('aria-sort="descending"');
  });

  it('omits aria-sort when inactive', () => {
    const markup = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <Table.SortableHeaderCell sortKey="name" sort={null} onSort={() => {}}>
              Name
            </Table.SortableHeaderCell>
          </tr>
        </thead>
      </table>
    );
    expect(markup).not.toContain('aria-sort');
  });
});

describe('Table.EmptyRow', () => {
  it('renders a td with the given colSpan', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <Table.EmptyRow colSpan={5} title="No rows" />
        </tbody>
      </table>
    );
    expect(markup).toContain('colSpan="5"');
    expect(markup).toContain('No rows');
  });
});

describe('Table.GroupHeaderRow', () => {
  it('renders a td with the given colSpan', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <Table.GroupHeaderRow colSpan={4}>Workspace</Table.GroupHeaderRow>
        </tbody>
      </table>
    );
    expect(markup).toContain('colSpan="4"');
    expect(markup).toContain('Workspace');
  });
});

describe('Table.Row sticky offsets', () => {
  it('computes each sticky cell left offset from the widths of preceding sticky siblings', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <Table.Row>
            <Table.Cell sticky width={32}>a</Table.Cell>
            <Table.Cell sticky width={160}>b</Table.Cell>
            <Table.Cell>c</Table.Cell>
          </Table.Row>
        </tbody>
      </table>
    );
    expect(markup).toContain('left:0');
    expect(markup).toContain('left:32px');
  });

  it('leaves non-sticky cells untouched', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <Table.Row>
            <Table.Cell width={32}>a</Table.Cell>
          </Table.Row>
        </tbody>
      </table>
    );
    expect(markup).not.toContain('left:');
  });

  it('defaults a sticky CheckboxCell to a 32px width when accumulating offsets', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <Table.Row>
            <Table.CheckboxCell sticky aria-label="Select row" checked={false} onChange={() => {}} />
            <Table.Cell sticky width={100}>b</Table.Cell>
          </Table.Row>
        </tbody>
      </table>
    );
    expect(markup).toContain('left:0');
    expect(markup).toContain('left:32px');
  });
});

describe('Table.DotsButton', () => {
  it('defaults aria-label to "Actions"', () => {
    const markup = renderToStaticMarkup(<Table.DotsButton />);
    expect(markup).toContain('aria-label="Actions"');
  });

  it('allows overriding aria-label', () => {
    const markup = renderToStaticMarkup(<Table.DotsButton aria-label="Row actions" />);
    expect(markup).toContain('aria-label="Row actions"');
  });
});

describe('Table.CheckboxCell', () => {
  it('renders as td by default', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <Table.CheckboxCell aria-label="Select row" checked={false} onChange={() => {}} />
          </tr>
        </tbody>
      </table>
    );
    expect(markup).toContain('<td');
    expect(markup).toContain('type="checkbox"');
  });

  it('renders as th when as="th"', () => {
    const markup = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <Table.CheckboxCell as="th" aria-label="Select all" checked={false} onChange={() => {}} />
          </tr>
        </thead>
      </table>
    );
    expect(markup).toContain('<th');
  });
});
