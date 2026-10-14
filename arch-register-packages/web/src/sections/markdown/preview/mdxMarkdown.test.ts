import { describe, expect, it, vi } from 'vitest';
import type { ASTNode } from '@diagram-craft/markdown';

// Stub the component registry so this test only exercises the parser grammar,
// independent of each component's own (heavy) implementation modules.
vi.mock('../mdx-components/componentRegistry', () => {
  const mdxSpecs: Record<
    string,
    {
      mode: string;
      allowedProps: string[];
      acceptsChildren?: boolean;
      acceptsRichContent?: boolean;
      dashboardOnly?: boolean;
    }
  > = {
    DiagramEmbed: { mode: 'block', allowedProps: ['id'] },
    EntityCard: { mode: 'block', allowedProps: ['id'] },
    EntityGraph: { mode: 'block', allowedProps: ['id', 'depth', 'direction'] },
    EntityMention: { mode: 'inline', allowedProps: ['id'] },
    Caption: { mode: 'block', allowedProps: ['caption'], acceptsChildren: true },
    Callout: { mode: 'block', allowedProps: ['variant'], acceptsRichContent: true },
    EntityLifecycleChart: { mode: 'block', allowedProps: [], dashboardOnly: true }
  };
  const forWiki = () =>
    Object.fromEntries(Object.entries(mdxSpecs).filter(([, spec]) => !spec.dashboardOnly));
  return {
    getComponentDefinition: (name: string) => {
      const mdx = mdxSpecs[name];
      return mdx ? { type: name, mdx } : undefined;
    },
    getWikiMdxComponents: forWiki
  };
});

const { parseMarkdownWithComponents } = await import('./mdxMarkdown');

describe('parseMarkdownWithComponents', () => {
  it('parses GFM checklist items with their checked state', () => {
    const ast = parseMarkdownWithComponents('- [x] Done\n- [ ] Not done');
    const list = ast[0];

    expect(list?.type).toBe('list');
    if (list?.type !== 'list') return;
    expect(list.children?.map(item => (item.type === 'item' ? item.checked : undefined))).toEqual([
      true,
      false
    ]);
  });

  it('parses a self-closing block component (regression)', () => {
    const ast = parseMarkdownWithComponents('<DiagramEmbed id="d1" />');
    expect(ast).toEqual([
      {
        type: 'component',
        subtype: 'block',
        name: 'DiagramEmbed',
        props: { id: 'd1' },
        source: '<DiagramEmbed id="d1" />'
      }
    ]);
  });

  it('parses a Caption wrapping exactly one valid block child', () => {
    const ast = parseMarkdownWithComponents(
      '<Caption caption="A diagram">\n<DiagramEmbed id="d1" />\n</Caption>'
    );
    expect(ast).toHaveLength(1);
    const node = ast[0] as { type: string; name: string; children?: unknown[] };
    expect(node.type).toBe('component');
    expect(node.name).toBe('Caption');
    expect(node.children).toEqual([
      {
        type: 'component',
        subtype: 'block',
        name: 'DiagramEmbed',
        props: { id: 'd1' },
        source: '<DiagramEmbed id="d1" />'
      }
    ]);
  });

  it('degrades to literal when Caption has zero children', () => {
    const ast = parseMarkdownWithComponents('<Caption caption="Empty">\n</Caption>');
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });

  it('degrades to literal when Caption has more than one child', () => {
    const ast = parseMarkdownWithComponents(
      '<Caption caption="Two">\n<DiagramEmbed id="d1" />\n<DiagramEmbed id="d2" />\n</Caption>'
    );
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });

  it('degrades to literal when the child is an inline-mode component', () => {
    const ast = parseMarkdownWithComponents(
      '<Caption caption="Inline child">\n<EntityMention id="e1" />\n</Caption>'
    );
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });

  it('degrades to literal when the child is an unknown component', () => {
    const ast = parseMarkdownWithComponents(
      '<Caption caption="Unknown child">\n<NotARealComponent id="x" />\n</Caption>'
    );
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });

  it('rejects a wrapper nested inside another wrapper (depth capped at 1)', () => {
    const ast = parseMarkdownWithComponents(
      '<Caption caption="Outer">\n<Caption caption="Inner">\n<DiagramEmbed id="d1" />\n</Caption>\n</Caption>'
    );
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });

  it('terminates without hanging on an unclosed Caption tag', () => {
    const ast = parseMarkdownWithComponents(
      '<Caption caption="Never closed">\n<DiagramEmbed id="d1" />\nsome more text'
    );
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });

  it('still parses self-closing components correctly with the wrapper handler registered first', () => {
    const ast = parseMarkdownWithComponents('<EntityCard id="e1" />');
    expect(ast).toEqual([
      {
        type: 'component',
        subtype: 'block',
        name: 'EntityCard',
        props: { id: 'e1' },
        source: '<EntityCard id="e1" />'
      }
    ]);
  });

  it('parses a Callout wrapping arbitrary rich markdown content', () => {
    const ast = parseMarkdownWithComponents(
      '<Callout variant="warning">\nFirst paragraph\n\n- Item one\n- Item two\n</Callout>'
    );
    expect(ast).toHaveLength(1);
    const node = ast[0] as { type: string; name: string; props: unknown; children?: ASTNode[] };
    expect(node.type).toBe('component');
    expect(node.name).toBe('Callout');
    expect(node.props).toEqual({ variant: 'warning' });
    expect(node.children?.map(child => child.type)).toEqual(['paragraph', 'list']);
  });

  it('parses headings inside a Callout even when the serializer indents them', () => {
    // The real Plate markdown serializer indents a JSX flow element's children
    // by two spaces (e.g. `  ## Heading`); without dedenting, an indented ATX
    // heading is misread as literal paragraph text instead of a heading node.
    const ast = parseMarkdownWithComponents(
      '<Callout variant="warning">\n  ## Heading\n\n  Some text\n</Callout>'
    );
    expect(ast).toHaveLength(1);
    const node = ast[0] as { type: string; children?: ASTNode[] };
    expect(node.children?.map(child => child.type)).toEqual(['heading', 'paragraph']);
  });

  it('parses an empty Callout with no children rather than degrading to literal', () => {
    const ast = parseMarkdownWithComponents('<Callout variant="info">\n</Callout>');
    expect(ast).toHaveLength(1);
    const node = ast[0] as { type: string; name: string; children?: unknown[] };
    expect(node.type).toBe('component');
    expect(node.children).toEqual([]);
  });

  it('parses a Callout containing another MDX component alongside markdown', () => {
    const ast = parseMarkdownWithComponents(
      '<Callout variant="note">\nSee below:\n\n<DiagramEmbed id="d1" />\n</Callout>'
    );
    expect(ast).toHaveLength(1);
    const node = ast[0] as { type: string; children?: ASTNode[] };
    expect(node.children?.map(child => child.type)).toEqual(['paragraph', 'component']);
  });

  it('does not parse a dashboard-only component as a component node in wiki content', () => {
    const ast = parseMarkdownWithComponents('<EntityLifecycleChart />');
    expect(ast.every(n => n.type !== 'component')).toBe(true);
  });
});
