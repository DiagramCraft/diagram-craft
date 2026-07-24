import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Columns } from './Columns';

describe('Columns', () => {
  it('renders children in a grid', () => {
    const markup = renderToStaticMarkup(
      <Columns count="2">
        <div data-testid="col1">First</div>
        <div data-testid="col2">Second</div>
      </Columns>
    );

    expect(markup).toContain('data-testid="col1"');
    expect(markup).toContain('data-testid="col2"');
  });

  it('defaults to a two-column layout when count is missing', () => {
    const markup = renderToStaticMarkup(<Columns>text</Columns>);
    expect(markup).toContain('data-count="2"');
  });

  it('uses a three-column layout when count is "3"', () => {
    const markup = renderToStaticMarkup(<Columns count="3">text</Columns>);
    expect(markup).toContain('data-count="3"');
  });

  it('falls back to a two-column layout for an unrecognized count', () => {
    const markup = renderToStaticMarkup(<Columns count="7">text</Columns>);
    expect(markup).toContain('data-count="2"');
  });
});
