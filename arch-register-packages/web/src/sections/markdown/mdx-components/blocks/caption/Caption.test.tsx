import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Caption } from './Caption';

describe('Caption', () => {
  it('renders a figure with figcaption and passed-through children', () => {
    const markup = renderToStaticMarkup(
      <Caption caption="A diagram of the flow">
        <span data-testid="child">child content</span>
      </Caption>
    );

    expect(markup).toContain('<figure');
    expect(markup).toContain('<figcaption');
    expect(markup).toContain('A diagram of the flow');
    expect(markup).toContain('data-testid="child"');
    expect(markup).toContain('child content');
  });

  it('omits figcaption when no caption text is provided', () => {
    const markup = renderToStaticMarkup(
      <Caption>
        <span>child</span>
      </Caption>
    );
    expect(markup).not.toContain('<figcaption');
  });

  it('prefixes "Figure:" when numbered is set', () => {
    const markup = renderToStaticMarkup(<Caption caption="Text" numbered="true" />);
    expect(markup).toContain('Figure:');
  });

  it('does not prefix "Figure:" when numbered is not set', () => {
    const markup = renderToStaticMarkup(<Caption caption="Text" />);
    expect(markup).not.toContain('Figure:');
  });

  it.each([
    ['left', 'alignLeft'],
    ['right', 'alignRight'],
    ['center', 'alignCenter'],
    [undefined, 'alignCenter']
  ] as const)('applies the %s alignment class', (align, expectedClassFragment) => {
    const markup = renderToStaticMarkup(<Caption caption="x" align={align} />);
    expect(markup).toContain(expectedClassFragment);
  });
});
