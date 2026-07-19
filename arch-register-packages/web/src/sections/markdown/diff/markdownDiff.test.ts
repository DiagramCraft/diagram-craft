import { describe, test, expect } from 'vitest';
import { diffMarkdown } from './markdownDiff';

const modifiedInlineHtml = (base: string, target: string): string => {
  const rows = diffMarkdown(base, target);
  const modified = rows.find(r => r.kind === 'modified');
  expect(
    modified,
    `expected a 'modified' row, got: ${JSON.stringify(rows.map(r => r.kind))}`
  ).toBeTruthy();
  return (modified as Extract<(typeof rows)[number], { kind: 'modified' }>).inlineHtml;
};

// Very small well-formedness check: every opening tag (ins/del included) must have a
// matching closing tag in the right order, i.e. no tag boundary was split by ins/del.
const assertWellFormed = (html: string) => {
  const stack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const full = match[0]!;
    const name = match[1]!;
    if (/^<[a-zA-Z][a-zA-Z0-9-]*[^>]*\/>$/.test(full)) continue; // self-closing
    if (full.startsWith('</')) {
      const top = stack.pop();
      expect(top, `unbalanced closing tag </${name}> in: ${html}`).toBe(name);
    } else {
      stack.push(name);
    }
  }
  expect(stack, `unclosed tags remain in: ${html}`).toEqual([]);
};

describe('diffMarkdown', () => {
  test('changed href wraps the whole link, not a fragment of the tag', () => {
    const html = modifiedInlineHtml(
      'See the [docs](https://example.com/old) for details.',
      'See the [docs](https://example.com/new) for details.'
    );
    assertWellFormed(html);
    expect(html).toContain('<del><a href="https://example.com/old">docs</a></del>');
    expect(html).toContain('<ins><a href="https://example.com/new">docs</a></ins>');
    // surrounding text is untouched
    expect(html).toContain('See the');
    expect(html).toContain('for details.');
  });

  test('nested formatting: only the changed word inside emphasis is wrapped', () => {
    const html = modifiedInlineHtml('**bold _italic_ text**', '**bold _different_ text**');
    assertWellFormed(html);
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain('<del>italic</del>');
    expect(html).toContain('<ins>different</ins>');
    // unrelated words are not wrapped
    expect(html).not.toMatch(/<(ins|del)>bold/);
    expect(html).not.toMatch(/<(ins|del)>text/);
  });

  test('raw inline HTML embedded in text is never split mid-tag', () => {
    // This markdown engine passes `<tag ...>`/`</tag>` runs embedded in plain text through
    // unescaped, so a naive whitespace-token diff can wrap <ins>/<del> around a fragment
    // that lands inside the tag's own angle brackets. The tag must stay intact as one unit.
    const html = modifiedInlineHtml(
      'Note: <span class="tag">old</span> value.',
      'Note: <span class="tag">new</span> value.'
    );
    assertWellFormed(html);
    expect(html).toContain('<span class="tag">');
    expect(html).toContain('<del>old</del>');
    expect(html).toContain('<ins>new</ins>');
    // the tag itself must never be split open by an ins/del boundary
    expect(html).not.toMatch(/<span[^>]*<(ins|del)>/);
    expect(html).not.toMatch(/<(ins|del)>[^<]*class=/);
  });

  test('whitespace-only change is diffed at token level', () => {
    const html = modifiedInlineHtml('Hello  world', 'Hello world');
    assertWellFormed(html);
    // one of the two whitespace runs should show up as an add/remove, preserving the space
    expect(html).toMatch(/<(ins|del)>\s+<\/(ins|del)>/);
  });

  test('unrelated unchanged paragraphs are not reported as modified', () => {
    const rows = diffMarkdown('Same paragraph.', 'Same paragraph.');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('unchanged');
  });
});
