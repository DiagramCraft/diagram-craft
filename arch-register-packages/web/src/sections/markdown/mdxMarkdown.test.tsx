import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownEngine } from '@diagram-craft/markdown';
import { parseMarkdownPreview, renderMarkdownPreview } from './mdxMarkdown';

vi.mock('./mdxComponents', () => ({
  MDX_COMPONENTS: {
    EntityCard: {
      component: ({ id, fields }: { id: string; fields?: string }) => (
        <section data-kind="EntityCard" data-id={id} data-fields={fields ?? ''} />
      ),
      mode: 'block',
      allowedProps: ['id', 'fields'],
    },
    EntityField: {
      component: ({ id, field }: { id: string; field: string }) => (
        <span data-kind="EntityField" data-id={id} data-field={field} />
      ),
      mode: 'inline',
      allowedProps: ['id', 'field'],
    },
  },
}));

describe('mdx markdown preview parsing', () => {
  it('parses block components into component AST nodes', () => {
    expect(parseMarkdownPreview('<EntityCard id="payment-service" />')).toEqual([
      {
        type: 'component',
        subtype: 'block',
        name: 'EntityCard',
        props: { id: 'payment-service' },
        source: '<EntityCard id="payment-service" />',
      },
    ]);
  });

  it('parses inline components inside paragraphs', () => {
    expect(parseMarkdownPreview('Owner: <EntityField id="svc" field="owner" />')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'literal', value: 'Owner: ' },
          {
            type: 'component',
            subtype: 'inline',
            name: 'EntityField',
            props: { id: 'svc', field: 'owner' },
            source: '<EntityField id="svc" field="owner" />',
          },
        ],
      },
    ]);
  });

  it('does not parse inline components inside code spans', () => {
    expect(parseMarkdownPreview('`<EntityField id="svc" field="owner" />`')).toEqual([
      {
        type: 'paragraph',
        children: [
          {
            type: 'code',
            inline: true,
            children: [{ type: 'literal', value: '<EntityField id="svc" field="owner" />' }],
          },
        ],
      },
    ]);
  });

  it('leaves unknown component names as plain markdown text', () => {
    const ast = parseMarkdownPreview('Hello <UnknownThing id="svc" />');
    expect(JSON.stringify(ast)).not.toContain('"type":"component"');
  });

  it('drops disallowed props from known components', () => {
    expect(parseMarkdownPreview('<EntityField id="svc" field="owner" bad="x" />')).toEqual([
      {
        type: 'paragraph',
        children: [
          {
            type: 'component',
            subtype: 'inline',
            name: 'EntityField',
            props: { id: 'svc', field: 'owner' },
            source: '<EntityField id="svc" field="owner" bad="x" />',
          },
        ],
      },
    ]);
  });
});

describe('mdx markdown preview rendering', () => {
  it('renders plain markdown', () => {
    const html = renderToStaticMarkup(renderMarkdownPreview(parseMarkdownPreview('Hello **world**')));
    expect(html).toContain('<p>Hello <strong>world</strong></p>');
  });

  it('renders block and inline components in order', () => {
    const ast = parseMarkdownPreview(
      '# Title\n\n<EntityCard id="payment-service" />\n\nOwner: <EntityField id="svc" field="owner" />',
      true
    );
    const html = renderToStaticMarkup(renderMarkdownPreview(ast));
    expect(html).toContain('<section data-kind="EntityCard" data-id="payment-service"');
    expect(html).toContain('<p>Owner: <span data-kind="EntityField" data-id="svc" data-field="owner"></span></p>');
    expect(html).not.toContain('<h1>');
  });
});

describe('@diagram-craft/markdown component fallback html', () => {
  it('renders component AST source back to HTML', () => {
    const html = new MarkdownEngine().toHTML([
      {
        type: 'component',
        subtype: 'block',
        name: 'EntityCard',
        props: { id: 'svc' },
        source: '<EntityCard id="svc" />',
      },
    ]);

    expect(html).toBe('<EntityCard id="svc" />');
  });
});
