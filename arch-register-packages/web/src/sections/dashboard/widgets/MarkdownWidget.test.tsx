import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownWidget } from './MarkdownWidget';

describe('MarkdownWidget', () => {
  it('renders authored Markdown including the first heading', () => {
    const html = renderToStaticMarkup(
      <MarkdownWidget
        config={{ title: 'Notes', markdown: '# Heading\n\n**Important**\n\n- One' }}
      />
    );

    expect(html).toContain('<h1');
    expect(html).toContain('<strong>Important</strong>');
    expect(html).toContain('<li>One</li>');
  });

  it('shows an empty state when the Markdown body is blank', () => {
    const html = renderToStaticMarkup(
      <MarkdownWidget config={{ title: 'Notes', markdown: '  ' }} />
    );

    expect(html).toContain('No markdown content.');
  });
});
