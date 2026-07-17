import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Column } from './Column';

describe('Column', () => {
  it('renders its children', () => {
    const markup = renderToStaticMarkup(
      <Column>
        <p data-testid="child">Some prose</p>
      </Column>
    );

    expect(markup).toContain('data-testid="child"');
    expect(markup).toContain('Some prose');
  });

  it('renders without children', () => {
    const markup = renderToStaticMarkup(<Column />);
    expect(markup).toContain('<div');
  });
});
