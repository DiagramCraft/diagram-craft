import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const Wrapper = ({ caption, children }: { caption?: string; children?: React.ReactNode }) => (
  <div data-testid="wrapper" data-caption={caption}>
    {children}
  </div>
);

const Leaf = ({ id }: { id?: string }) => <span data-testid="leaf">{id}</span>;

vi.mock('../mdx-components/mdxRegistry', () => {
  const MDX_COMPONENTS = {
    Wrapper: {
      component: Wrapper,
      mode: 'block',
      allowedProps: ['caption'],
      acceptsChildren: true
    },
    Leaf: { component: Leaf, mode: 'block', allowedProps: ['id'] }
  };
  return {
    MDX_COMPONENTS,
    getMdxSpec: (name: string) => MDX_COMPONENTS[name as keyof typeof MDX_COMPONENTS]
  };
});

const { renderNodes, renderMarkdownPreview, splitTextWithRanges } = await import('./mdxRenderNode');

describe('renderNodes — component children threading', () => {
  it('renders nested children inside the wrapping component when present', () => {
    const markup = renderToStaticMarkup(
      renderNodes(
        [
          {
            type: 'component',
            subtype: 'block',
            name: 'Wrapper',
            props: { caption: 'A leaf' },
            source: '',
            children: [
              {
                type: 'component',
                subtype: 'block',
                name: 'Leaf',
                props: { id: 'leaf-1' },
                source: ''
              }
            ]
          }
        ],
        'root'
      )
    );

    expect(markup).toContain('data-testid="wrapper"');
    expect(markup).toContain('data-testid="leaf"');
    expect(markup).toContain('leaf-1');
  });

  it('renders with no children when node.children is absent (no regression)', () => {
    const markup = renderToStaticMarkup(
      renderNodes(
        [
          { type: 'component', subtype: 'block', name: 'Leaf', props: { id: 'leaf-2' }, source: '' }
        ],
        'root'
      )
    );

    expect(markup).toContain('leaf-2');
    expect(markup).not.toContain('data-testid="wrapper"');
  });

  it('renders checklist controls as disabled in view mode', () => {
    const markup = renderToStaticMarkup(
      renderNodes(
        [
          {
            type: 'list',
            subtype: 'unordered',
            children: [
              { type: 'item', checked: true, children: [{ type: 'literal', value: 'Done' }] },
              {
                type: 'item',
                checked: false,
                children: [{ type: 'literal', value: 'Not done' }]
              }
            ]
          }
        ],
        'root'
      )
    );

    expect(markup).toContain('class="task-list"');
    expect(markup).toContain('checked=""');
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });

  it('renders strikethrough text in view mode', () => {
    const markup = renderToStaticMarkup(
      renderNodes(
        [
          {
            type: 'strikethrough',
            children: [{ type: 'literal', value: 'Removed text' }]
          }
        ],
        'root'
      )
    );

    expect(markup).toBe('<del>Removed text</del>');
  });
});

describe('splitTextWithRanges', () => {
  it('returns the whole text unsplit when no range overlaps', () => {
    expect(
      splitTextWithRanges('hello world', 0, [{ commentId: 'c1', start: 20, end: 25 }])
    ).toEqual([{ text: 'hello world' }]);
  });

  it('splits a literal that is fully covered by a range', () => {
    expect(splitTextWithRanges('hello', 0, [{ commentId: 'c1', start: 0, end: 5 }])).toEqual([
      { text: 'hello', commentId: 'c1' }
    ]);
  });

  it('splits mid-literal when the range starts inside it', () => {
    expect(splitTextWithRanges('hello world', 0, [{ commentId: 'c1', start: 6, end: 11 }])).toEqual(
      [{ text: 'hello ' }, { text: 'world', commentId: 'c1' }]
    );
  });

  it('splits a range that ends before the end of the literal', () => {
    expect(splitTextWithRanges('hello world', 0, [{ commentId: 'c1', start: 0, end: 5 }])).toEqual([
      { text: 'hello', commentId: 'c1' },
      { text: ' world' }
    ]);
  });

  it('accounts for a non-zero starting offset', () => {
    // literal "world" starts at plain-text offset 6 (after "hello ")
    expect(splitTextWithRanges('world', 6, [{ commentId: 'c1', start: 6, end: 9 }])).toEqual([
      { text: 'wor', commentId: 'c1' },
      { text: 'ld' }
    ]);
  });

  it('handles a range spanning across sibling literals by clipping to the given text window', () => {
    // Simulates rendering "wor" then "ld" as two separate literals both inside one range [6,11)
    expect(splitTextWithRanges('wor', 6, [{ commentId: 'c1', start: 6, end: 11 }])).toEqual([
      { text: 'wor', commentId: 'c1' }
    ]);
    expect(splitTextWithRanges('ld', 9, [{ commentId: 'c1', start: 6, end: 11 }])).toEqual([
      { text: 'ld', commentId: 'c1' }
    ]);
  });
});

describe('renderMarkdownPreview — highlight ranges', () => {
  it('wraps the covered text in a mark with the comment id', () => {
    const markup = renderToStaticMarkup(
      renderMarkdownPreview(
        [
          {
            type: 'paragraph',
            children: [{ type: 'literal', value: 'hello world' }]
          }
        ],
        [{ commentId: 'c1', start: 6, end: 11 }]
      )
    );

    expect(markup).toBe('<p>hello <mark data-comment-id="c1">world</mark></p>');
  });

  it('marks the active comment with the active class', () => {
    const markup = renderToStaticMarkup(
      renderMarkdownPreview(
        [{ type: 'paragraph', children: [{ type: 'literal', value: 'hello world' }] }],
        [{ commentId: 'c1', start: 0, end: 5 }],
        { activeCommentId: 'c1' }
      )
    );

    expect(markup).toContain('class="wiki-comment-mark-active"');
  });

  it('advances the cursor across sibling nodes so a later literal still highlights correctly', () => {
    const markup = renderToStaticMarkup(
      renderMarkdownPreview(
        [
          {
            type: 'paragraph',
            children: [
              { type: 'literal', value: 'before ' },
              { type: 'strong', children: [{ type: 'literal', value: 'bold' }] },
              { type: 'literal', value: ' after' }
            ]
          }
        ],
        [{ commentId: 'c1', start: 7, end: 11 }]
      )
    );

    expect(markup).toBe(
      '<p>before <strong><mark data-comment-id="c1">bold</mark></strong> after</p>'
    );
  });
});
