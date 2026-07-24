import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FoldableSection } from './FoldableSection';

describe('FoldableSection', () => {
  it('renders children wrapped in a details element', () => {
    const markup = renderToStaticMarkup(
      <FoldableSection label="More info">
        <p data-testid="child">Some prose</p>
      </FoldableSection>
    );

    expect(markup).toContain('<details');
    expect(markup).toContain('data-testid="child"');
    expect(markup).toContain('Some prose');
  });

  it('renders the label in the summary', () => {
    const markup = renderToStaticMarkup(<FoldableSection label="Background">text</FoldableSection>);
    expect(markup).toContain('<summary');
    expect(markup).toContain('Background');
  });

  it('defaults to a generic label when none is given', () => {
    const markup = renderToStaticMarkup(<FoldableSection>text</FoldableSection>);
    expect(markup).toContain('Details');
  });

  it('defaults to a generic label when given an empty label', () => {
    const markup = renderToStaticMarkup(<FoldableSection label="  ">text</FoldableSection>);
    expect(markup).toContain('Details');
  });

  it('does not include the open attribute, so it defaults to collapsed', () => {
    const markup = renderToStaticMarkup(<FoldableSection label="Background">text</FoldableSection>);
    expect(markup).not.toContain('open=""');
    expect(markup).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it('wraps multiple block-level children (paragraphs, lists)', () => {
    const markup = renderToStaticMarkup(
      <FoldableSection label="Background">
        <p>First paragraph</p>
        <ul>
          <li>Item one</li>
        </ul>
      </FoldableSection>
    );

    expect(markup).toContain('First paragraph');
    expect(markup).toContain('Item one');
  });
});
