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

  it('renders combined inline formatting', () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown
        text={
          'Plain text, **bold text**, *italic text*, ***bold italic text***, and ~~strikethrough text~~.'
        }
      />
    );

    expect(html).toContain('<strong>bold text</strong>');
    expect(html).toContain('<em>italic text</em>');
    expect(html).toContain('<em><strong>bold italic text</strong></em>');
    expect(html).toContain('<del>strikethrough text</del>');
  });

  it('renders checklists as disabled checkboxes in read-only content', () => {
    const html = renderToStaticMarkup(<SafeMarkdown text={'- [x] Done\n- [ ] Not done'} />);

    expect(html).toContain('class="task-list"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).not.toContain('[x]');
    expect(html).not.toContain('[ ]');
  });
});
