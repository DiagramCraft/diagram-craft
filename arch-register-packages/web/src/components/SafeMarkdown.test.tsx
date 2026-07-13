import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SafeMarkdown } from './SafeMarkdown';

describe('SafeMarkdown', () => {
  it('renders GFM structures and safe external links', () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown
        text={'# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[Docs](https://example.com)'}
      />
    );
    expect(html).toContain('<h1');
    expect(html).toContain('<table');
    expect(html).toContain('rel="noreferrer"');
  });

  it('does not render raw HTML or unsafe links', () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown text={'<script>alert(1)</script>\n\n[bad](javascript:alert(1))'} />
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });

  it('renders entity links as buttons', () => {
    const html = renderToStaticMarkup(<SafeMarkdown text="[Entity](entity:entity-1)" />);
    expect(html).toContain('<button');
    expect(html).toContain('Entity');
  });
});
