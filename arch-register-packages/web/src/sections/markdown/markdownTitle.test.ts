import { describe, expect, test } from 'vitest';
import { extractFirstHeadingTitle, renderMarkdownWithoutFirstHeading } from './markdownTitle';

describe('markdownTitle', () => {
  test('extracts the first h1 title', () => {
    expect(extractFirstHeadingTitle('# System overview\n\nBody')).toBe('System overview');
  });

  test('ignores non-h1 headings', () => {
    expect(extractFirstHeadingTitle('## Subtitle\n\nBody')).toBeNull();
  });

  test('ignores empty h1 headings', () => {
    expect(extractFirstHeadingTitle('#    \n\nBody')).toBeNull();
  });

  test('renders markdown without the first h1 heading', () => {
    const html = renderMarkdownWithoutFirstHeading('# System overview\n\n## Details\n\nBody');

    expect(html).not.toContain('<h1>');
    expect(html).toContain('<h2>Details</h2>');
    expect(html).toContain('<p>Body</p>');
  });

  test('keeps later h1 headings intact', () => {
    const html = renderMarkdownWithoutFirstHeading('# First\n\n# Second');

    expect(html).not.toContain('<h1>First</h1>');
    expect(html).toContain('<h1>Second</h1>');
  });
});
