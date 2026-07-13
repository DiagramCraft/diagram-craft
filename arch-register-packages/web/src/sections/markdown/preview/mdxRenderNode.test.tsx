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

const { renderNodes } = await import('./mdxRenderNode');

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
});
