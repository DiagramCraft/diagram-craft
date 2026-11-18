import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Table } from './Table';

const lefts = (html: string) => [...html.matchAll(/left:(\d+)(?:px)?/g)].map(m => Number(m[1]));

describe('Table sticky offsets (legacy fallback)', () => {
  test('infers offsets from sticky children widths', () => {
    const html = renderToStaticMarkup(
      <Table.Root>
        <Table.Body>
          <Table.Row>
            <Table.Cell sticky width={100} />
            <Table.Cell sticky width={50} />
          </Table.Row>
        </Table.Body>
      </Table.Root>
    );
    expect(lefts(html)).toEqual([0, 100]);
  });

  test('keeps an explicit style.left', () => {
    const html = renderToStaticMarkup(
      <Table.Root>
        <Table.Body>
          <Table.Row>
            <Table.Cell sticky width={100} style={{ left: 7 }} />
          </Table.Row>
        </Table.Body>
      </Table.Root>
    );
    expect(lefts(html)).toEqual([7]);
  });
});

describe('Table column count', () => {
  const render = (columnCount?: number) =>
    renderToStaticMarkup(
      <Table.Root columnCount={columnCount}>
        <Table.Head>
          <tr>
            <Table.HeaderCell>A</Table.HeaderCell>
            <Table.HeaderCell>B</Table.HeaderCell>
          </tr>
        </Table.Head>
        <Table.Body>
          <Table.DetailRow>detail</Table.DetailRow>
        </Table.Body>
      </Table.Root>
    );

  test('is inferred from the header when not given', () => {
    expect(render()).toContain('colSpan="2"');
  });

  test('explicit columnCount overrides inference', () => {
    expect(render(5)).toContain('colSpan="5"');
  });
});
